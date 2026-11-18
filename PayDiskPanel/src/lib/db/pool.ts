import { join } from "path";
import { pathToFileURL } from "url";
import {
  AMAR_DB,
  DB_TARGETS,
  TEST_DB,
  type DbTargetId,
  ensureActiveTarget,
  getActiveDbLabel,
  getTargetMeta,
  hqWritesEnabled,
  isLabDb,
  peekActiveTarget,
  persistActiveTarget,
  reloadActiveTargetFromDisk,
  targetAllowsWrites,
  tediousConfigFor,
  tediousWriteConfigFor,
  windowsConnectionString,
} from "./config";
import {
  clearSchemaCapsCache,
  defaultSchemaCaps,
  detectSchemaCaps,
  resolveSchemaCaps,
  type DbSchemaCaps,
} from "./schema";

type AnyRequest = {
  /** Per-request ms override (mssql / msnodesqlv8). Calculate* needs 15–30+ min. */
  timeout?: number;
  input: (...args: unknown[]) => AnyRequest;
  query: (q: string) => Promise<{
    recordset: Record<string, unknown>[];
    recordsets?: unknown[];
    rowsAffected?: number | number[];
  }>;
  execute: (proc: string) => Promise<{
    recordset: Record<string, unknown>[];
    recordsets?: unknown[];
    rowsAffected?: number | number[];
  }>;
};

/** Lab Calculate* SPs routinely exceed the old 120s pool default. */
export const LAB_CALC_REQUEST_TIMEOUT_MS = 30 * 60 * 1000;

type AnyPool = {
  request: () => AnyRequest;
  close: () => Promise<void>;
};

type SqlModule = {
  connect: (cfg: object) => Promise<AnyPool>;
  ConnectionPool: new (cfg: object) => { connect: () => Promise<AnyPool> };
  NVarChar: unknown;
  Int: unknown;
  BigInt: unknown;
  Date: unknown;
  DateTime: unknown;
};

type Drivers = {
  loadTedious: () => SqlModule;
  loadWindows: () => SqlModule;
};

/** Ready pools — switch/list reuse these without reconnecting. */
const live = new Map<DbTargetId, AnyPool>();
/** Dedicated write pools (prod write login may differ from read). */
const writeLive = new Map<DbTargetId, AnyPool>();
/** In-flight connect per target (at most one — critical for msnodesqlv8). */
const inflight = new Map<DbTargetId, Promise<AnyPool>>();
const writeInflight = new Map<DbTargetId, Promise<AnyPool>>();

let drivers: Drivers | null = null;
let driversReady: Promise<Drivers> | null = null;
let switchLock: Promise<void> = Promise.resolve();

function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

async function getDrivers(): Promise<Drivers> {
  if (drivers) return drivers;
  if (!driversReady) {
    driversReady = (async () => {
      const href = pathToFileURL(
        join(process.cwd(), "src/lib/db/sql-drivers.cjs"),
      ).href;
      const loaded = (await import(/* webpackIgnore: true */ href)) as Drivers & {
        default?: Drivers;
      };
      drivers = loaded.default ?? loaded;
      return drivers;
    })().catch((err) => {
      driversReady = null;
      throw err;
    });
  }
  return driversReady;
}

/**
 * Prefetch drivers without mixing connect attempts.
 * Tedious first (157/155); Windows/ODBC separately for lab.
 * Always leave shared.driver bound to the *active* target — ending on
 * loadWindows() caused «connection.queryRaw is not a function» on 155/157
 * when a Tedious pool.request() raced the preload.
 */
export function preloadSqlDrivers() {
  void (async () => {
    try {
      const d = await getDrivers();
      d.loadTedious();
      try {
        d.loadWindows();
      } catch {
        /* lab ODBC optional at boot */
      }
      const active = peekActiveTarget();
      if (DB_TARGETS[active].auth === "windows") d.loadWindows();
      else d.loadTedious();
    } catch {
      /* ignore */
    }
  })();
}

/**
 * mssql keeps one process-wide Request class. Rebind before every request()
 * so a lab ODBC touch cannot leave msnodesqlv8 bound onto a Tedious pool.
 */
function wrapPool(pool: AnyPool, target: DbTargetId): AnyPool {
  return {
    request: () => {
      if (!drivers) {
        throw new Error("SQL driver not loaded yet — await getReadPool() first");
      }
      if (DB_TARGETS[target].auth === "windows") drivers.loadWindows();
      else drivers.loadTedious();
      return pool.request();
    },
    close: () => pool.close(),
  };
}

export function getDbTarget() {
  const m = getTargetMeta();
  return `${m.host}/${m.database}`;
}

export function getDbMode(): DbTargetId {
  return peekActiveTarget();
}

async function dropPool(target: DbTargetId, opts?: { cancelInflight?: boolean }) {
  const p = live.get(target);
  live.delete(target);
  // Never clear inflight on a normal failure — a second parallel ODBC connect
  // while the first is still opening is what wedged the transaction list.
  if (opts?.cancelInflight) inflight.delete(target);
  clearSchemaCapsCache(target);
  if (p) {
    try {
      await p.close();
    } catch {
      /* ignore */
    }
  }
}

export async function closeActivePool() {
  const ids = [...new Set([...live.keys(), ...inflight.keys()])];
  await Promise.all(ids.map((id) => dropPool(id, { cancelInflight: true })));
}

/**
 * Recreate lab pool so Calculate* picks up LAB_CALC_REQUEST_TIMEOUT_MS
 * (hot-reload otherwise keeps a 120s pool forever).
 */
export async function refreshLabPool() {
  await dropPool("test");
}

/** Rebind mssql shared.driver for this target (required before every request()). */
async function activateDriver(target: DbTargetId): Promise<Drivers> {
  const d = await getDrivers();
  if (DB_TARGETS[target].auth === "windows") d.loadWindows();
  else d.loadTedious();
  return d;
}

async function openPool(target: DbTargetId): Promise<AnyPool> {
  const d = await activateDriver(target);
  const meta = DB_TARGETS[target];

  if (meta.auth === "windows") {
    // LoginTimeout in the ODBC string is the real deadline — do NOT Promise.race
    // abandon this connect (orphan ODBC opens deadlock the next attempt).
    const sqlWin = d.loadWindows();
    return new sqlWin.ConnectionPool({
      connectionString: windowsConnectionString(),
      connectionTimeout: 15000,
      // Lab hosts Calculate* — default must be long; procs also set request.timeout.
      requestTimeout: LAB_CALC_REQUEST_TIMEOUT_MS,
      pool: { max: 3, min: 0, idleTimeoutMillis: 60000 },
    }).connect();
  }

  const sql = d.loadTedious();
  const cfg = tediousConfigFor(target);
  if (!cfg) {
    throw new Error(
      "SQL credentials missing (.env.local PAYDISK_SQL_USER / PAYDISK_SQL_PASSWORD_B64)",
    );
  }
  return new sql.ConnectionPool({
    ...cfg,
    connectionTimeout: 10000,
    requestTimeout: 120000,
    pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
  }).connect() as unknown as Promise<AnyPool>;
}

/**
 * One connection attempt per target at a time.
 * Reuses live pools. Never overlaps ODBC connects.
 */
async function ensurePool(target: DbTargetId): Promise<AnyPool> {
  const ready = live.get(target);
  if (ready) {
    // Critical: rebind driver — lab ODBC may have overwritten shared.driver
    await activateDriver(target);
    return wrapPool(ready, target);
  }

  const pending = inflight.get(target);
  if (pending) {
    const pool = await pending;
    await activateDriver(target);
    return wrapPool(pool, target);
  }

  let attempt!: Promise<AnyPool>;
  attempt = (async () => {
    try {
      const pool = await openPool(target);
      // Verify with a cheap query before publishing as live
      try {
        await pool.request().query("SELECT 1 AS ok");
      } catch (err) {
        try {
          await pool.close();
        } catch {
          /* ignore */
        }
        throw err;
      }
      live.set(target, pool);
      // Schema probe after publish — must not block connect success
      void detectSchemaCaps(pool, target).catch(() => null);
      return pool;
    } catch (err) {
      live.delete(target);
      const label = DB_TARGETS[target].labelFa;
      const base = err instanceof Error ? err.message : String(err);
      if (/timeout|Login failed|ELOGIN|connect/i.test(base) || target === "test") {
        throw new Error(
          base.includes("اتصال به")
            ? base
            : `اتصال به ${label} برقرار نشد — ${base}`,
        );
      }
      throw err;
    } finally {
      if (inflight.get(target) === attempt) inflight.delete(target);
    }
  })();

  inflight.set(target, attempt);

  // Soft ceiling for SQL (tedious). Lab relies on ODBC LoginTimeout — still cap
  // so a wedged driver cannot block the UI forever.
  const ceilingMs = target === "test" ? 20000 : 12000;
  try {
    const pool = await withTimeout(
      attempt,
      ceilingMs,
      `اتصال به ${DB_TARGETS[target].labelFa} در ${ceilingMs / 1000}ثانیه برقرار نشد`,
    );
    await activateDriver(target);
    return wrapPool(pool, target);
  } catch (err) {
    // Do NOT delete inflight here if attempt is still running — let it finish
    // and close itself. Starting a parallel ODBC connect causes the hang you saw.
    throw err;
  }
}

export async function getReadPool(): Promise<AnyPool> {
  const target = await ensureActiveTarget();
  return ensurePool(target);
}

/** Open/reuse a specific target pool (e.g. login against 155 then 157). */
export async function getPoolForTarget(target: DbTargetId): Promise<AnyPool> {
  if (!DB_TARGETS[target]) throw new Error("هدف دیتابیس نامعتبر");
  return ensurePool(target);
}

export async function getSchemaCaps(
  target?: DbTargetId,
): Promise<DbSchemaCaps> {
  const id = target || (await ensureActiveTarget());
  // Always open/reuse the target pool and probe — defaults alone break type
  // filters when 155/157 schema differs from the static fallback.
  try {
    const pool = await ensurePool(id);
    return await detectSchemaCaps(pool, id);
  } catch {
    return resolveSchemaCaps(id);
  }
}

async function openWritePool(target: DbTargetId): Promise<AnyPool> {
  const d = await activateDriver(target);
  if (DB_TARGETS[target].auth === "windows") {
    return openPool(target);
  }
  const cfg = tediousWriteConfigFor(target);
  if (!cfg) {
    throw new Error(
      "Write credentials missing — set PAYDISK_HQ_WRITES=true and PAYDISK_SQL_WRITE_USER / PAYDISK_SQL_WRITE_PASSWORD_B64",
    );
  }
  const sql = d.loadTedious();
  return new sql.ConnectionPool({
    ...cfg,
    connectionTimeout: 10000,
    requestTimeout: LAB_CALC_REQUEST_TIMEOUT_MS,
    pool: { max: 3, min: 0, idleTimeoutMillis: 60000 },
  }).connect() as unknown as Promise<AnyPool>;
}

async function ensureWritePool(target: DbTargetId): Promise<AnyPool> {
  const readCfg = tediousConfigFor(target);
  const writeCfg = tediousWriteConfigFor(target);
  // Same login as read → reuse read pool (lab path uses windows via openPool).
  if (
    target === "test" ||
    (readCfg &&
      writeCfg &&
      readCfg.user === writeCfg.user &&
      readCfg.password === writeCfg.password)
  ) {
    return ensurePool(target);
  }

  const ready = writeLive.get(target);
  if (ready) {
    await activateDriver(target);
    return wrapPool(ready, target);
  }
  const pending = writeInflight.get(target);
  if (pending) {
    const pool = await pending;
    await activateDriver(target);
    return wrapPool(pool, target);
  }

  let attempt!: Promise<AnyPool>;
  attempt = (async () => {
    try {
      const pool = await openWritePool(target);
      await pool.request().query("SELECT 1 AS ok");
      writeLive.set(target, pool);
      return pool;
    } catch (err) {
      writeLive.delete(target);
      throw err;
    } finally {
      if (writeInflight.get(target) === attempt) writeInflight.delete(target);
    }
  })();
  writeInflight.set(target, attempt);
  const pool = await attempt;
  await activateDriver(target);
  return wrapPool(pool, target);
}

export async function getWritePool() {
  const target = await ensureActiveTarget();
  if (!targetAllowsWrites(target)) {
    throw new Error(
      target === "replica"
        ? "رپلیکا فقط خواندنی است — برای نوشتن به تولید (155) سوییچ کنید"
        : "Write/EXEC روی این دیتابیس مجاز نیست — lab یا تولید با PAYDISK_HQ_WRITES=true",
    );
  }
  return ensureWritePool(target);
}

export async function switchDbTarget(target: DbTargetId) {
  if (!DB_TARGETS[target]) throw new Error("هدف دیتابیس نامعتبر");

  const run = switchLock.then(async () => {
    if (peekActiveTarget() === target && live.has(target)) {
      return {
        target,
        label: getActiveDbLabel(),
        meta: getTargetMeta(target),
        schema: resolveSchemaCaps(target),
        reused: true as const,
      };
    }

    // Drop a stale live pool for this target so we re-verify on switch
    if (live.has(target) && peekActiveTarget() !== target) {
      // keep warm pool — just verify
    }

    let pool: AnyPool;
    try {
      pool = await ensurePool(target);
    } catch (err) {
      // Drop only a published pool; leave inflight alone so ODBC can finish/fail
      if (live.has(target)) await dropPool(target);
      throw err;
    }

    await persistActiveTarget(target);

    let caps: DbSchemaCaps;
    try {
      caps = await detectSchemaCaps(pool, target);
    } catch {
      caps = defaultSchemaCaps(target);
    }

    return {
      target,
      label: getActiveDbLabel(),
      meta: getTargetMeta(target),
      schema: caps,
      reused: false as const,
    };
  });

  switchLock = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/** Warm SQL peers only — never background-open lab/ODBC. */
export function warmTargetInBackground(target: DbTargetId) {
  if (!DB_TARGETS[target] || target === "test") return;
  if (live.has(target) || inflight.has(target)) return;
  void ensurePool(target).catch(() => {
    /* ignore */
  });
}

export async function getSqlTypes() {
  const d = await getDrivers();
  const target = await ensureActiveTarget();
  return DB_TARGETS[target].auth === "windows"
    ? d.loadWindows()
    : d.loadTedious();
}

export const sql = new Proxy({} as typeof import("mssql"), {
  get(_t, prop) {
    if (!drivers) {
      throw new Error("SQL driver not loaded yet — await getReadPool() first");
    }
    const target = peekActiveTarget();
    const mod =
      DB_TARGETS[target].auth === "windows"
        ? drivers.loadWindows()
        : drivers.loadTedious();
    return (mod as Record<string | symbol, unknown>)[prop];
  },
});

export {
  AMAR_DB,
  DB_TARGETS,
  TEST_DB,
  getActiveDbLabel,
  hqWritesEnabled,
  isLabDb,
  peekActiveTarget,
  ensureActiveTarget,
  reloadActiveTargetFromDisk,
  resolveSchemaCaps,
  targetAllowsWrites,
};
export type { DbTargetId };
