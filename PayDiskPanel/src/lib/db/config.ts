/**
 * SQL targets (switchable at runtime from Settings → Database):
 * - prod    @ 10.1.0.155 DB_Mostamary — HQ host (SQL login, read-only; no AmarDB on this server)
 * - replica @ 10.1.0.157 AmarDB — replication / cluster (SQL login, read-only)
 * - test    @ 10.0.28.10 DB_Mostamary — lab (Windows auth, writes allowed)
 *
 * Credentials stay in .env.local. Active target is stored in data/db-target.json.
 */

import { promises as fs } from "fs";
import path from "path";

export type DbTargetId = "prod" | "replica" | "test";

export type DbTargetMeta = {
  id: DbTargetId;
  labelFa: string;
  host: string;
  database: string;
  port: number;
  auth: "sql" | "windows";
  user: string;
  writable: boolean;
};

const TARGET_FILE = path.join(process.cwd(), "data", "db-target.json");

const SQL_USER = process.env.PAYDISK_SQL_USER || "alipoor";
/** Replica may use a different SQL login (e.g. alipoor2 exists only on 155). */
const SQL_REPLICA_USER =
  (process.env.PAYDISK_SQL_REPLICA_USER || "").trim() || SQL_USER;
const SQL_PORT = Number(process.env.PAYDISK_SQL_PORT || 1433);
/** Replica / legacy AmarDB name */
const AMAR_DB_NAME = process.env.PAYDISK_SQL_DATABASE || "AmarDB";
/**
 * 155 has no AmarDB — PayDisk schema lives in DB_Mostamary
 * (MakeOverTransactions / PayedMakeOvers / MakeOverDefinitions).
 */
const PROD_DB_NAME =
  process.env.PAYDISK_SQL_PROD_DATABASE || "DB_Mostamary";
const SQL_ENCRYPT = process.env.PAYDISK_SQL_ENCRYPT !== "false";
const SQL_TRUST = process.env.PAYDISK_SQL_TRUST_CERT !== "false";

const PROD_HOST = process.env.PAYDISK_SQL_HOST || "10.1.0.155";
const REPLICA_HOST =
  process.env.PAYDISK_SQL_REPLICA_HOST || "10.1.0.157";
const TEST_HOST = process.env.PAYDISK_TEST_SQL_HOST || "10.0.28.10";
const TEST_DB_NAME = process.env.PAYDISK_TEST_SQL_DATABASE || "DB_Mostamary";

export const DB_TARGETS: Record<DbTargetId, DbTargetMeta> = {
  prod: {
    id: "prod",
    labelFa: "تولید (اصلی)",
    host: PROD_HOST,
    database: PROD_DB_NAME,
    port: SQL_PORT,
    auth: "sql",
    user: SQL_USER,
    /** Set PAYDISK_HQ_WRITES=true + write login to allow INSERT/Calculate* on 155. */
    writable: process.env.PAYDISK_HQ_WRITES === "true",
  },
  replica: {
    id: "replica",
    labelFa: "رپلیکا (خواندنی)",
    host: REPLICA_HOST,
    database: process.env.PAYDISK_SQL_REPLICA_DATABASE || AMAR_DB_NAME,
    port: Number(process.env.PAYDISK_SQL_REPLICA_PORT || SQL_PORT),
    auth: "sql",
    user: SQL_REPLICA_USER,
    // Replica stays read-only — writes go to primary (155) only.
    writable: false,
  },
  test: {
    id: "test",
    labelFa: "آزمایشی (lab)",
    host: TEST_HOST,
    database: TEST_DB_NAME,
    port: 1433,
    auth: "windows",
    user: "(windows)",
    writable: true,
  },
};

/** @deprecated use DB_TARGETS.prod */
export const AMAR_DB = {
  host: DB_TARGETS.prod.host,
  database: DB_TARGETS.prod.database,
  port: DB_TARGETS.prod.port,
  user: DB_TARGETS.prod.user,
  encrypt: SQL_ENCRYPT,
  trustServerCertificate: SQL_TRUST,
} as const;

/** @deprecated use DB_TARGETS.test */
export const TEST_DB = {
  host: DB_TARGETS.test.host,
  database: DB_TARGETS.test.database,
  connectionString:
    process.env.PAYDISK_TEST_SQL_CONNECTION ||
    `Driver={ODBC Driver 18 for SQL Server};Server=${TEST_HOST};Database=${TEST_DB_NAME};Trusted_Connection=Yes;TrustServerCertificate=Yes;LoginTimeout=10;`,
} as const;

/** Fallback when no data/db-target.json yet */
function envDefaultTarget(): DbTargetId {
  const raw = (process.env.PAYDISK_DB_TARGET || "").trim().toLowerCase();
  if (raw === "prod" || raw === "replica" || raw === "test") return raw;
  if (process.env.PAYDISK_USE_TEST_DB === "true") return "test";
  return "prod";
}

let cachedTarget: DbTargetId | null = null;
let loadPromise: Promise<DbTargetId> | null = null;

async function readTargetFile(): Promise<DbTargetId | null> {
  try {
    const raw = await fs.readFile(TARGET_FILE, "utf8");
    const parsed = JSON.parse(raw) as { target?: string };
    const t = String(parsed?.target || "").toLowerCase();
    if (t === "prod" || t === "replica" || t === "test") return t;
  } catch {
    /* missing / invalid */
  }
  return null;
}

/**
 * Active DB = data/db-target.json (UI switch). Always re-read disk so
 * Next HMR / multi-request never stick on a stale in-memory lab target
 * while Settings shows 155.
 */
export async function ensureActiveTarget(): Promise<DbTargetId> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const fromFile = await readTargetFile();
    cachedTarget = fromFile || envDefaultTarget();
    return cachedTarget;
  })().finally(() => {
    loadPromise = null;
  });
  return loadPromise;
}

/** Force re-read from disk (e.g. after manual recovery). */
export async function reloadActiveTargetFromDisk(): Promise<DbTargetId> {
  cachedTarget = null;
  loadPromise = null;
  return ensureActiveTarget();
}

/** Sync peek — prefers cache, else env default (may lag one request after boot). */
export function peekActiveTarget(): DbTargetId {
  return cachedTarget || envDefaultTarget();
}

export async function persistActiveTarget(target: DbTargetId) {
  if (!DB_TARGETS[target]) throw new Error("هدف دیتابیس نامعتبر");
  await fs.mkdir(path.dirname(TARGET_FILE), { recursive: true });
  await fs.writeFile(
    TARGET_FILE,
    JSON.stringify({ target, updatedAt: new Date().toISOString() }, null, 2),
    "utf8",
  );
  cachedTarget = target;
}

export function getTargetMeta(id?: DbTargetId): DbTargetMeta {
  return DB_TARGETS[id || peekActiveTarget()];
}

export function isLabDb(id?: DbTargetId) {
  return (id || peekActiveTarget()) === "test";
}

/** Explicit opt-in for real Calculate* / INSERT on production (155). */
export function hqWritesEnabled() {
  return process.env.PAYDISK_HQ_WRITES === "true";
}

/**
 * Active target may run panel writes (create txn, Calculate*, Key2/Key3).
 * Lab always; prod only when PAYDISK_HQ_WRITES=true; replica never.
 */
export function targetAllowsWrites(id?: DbTargetId) {
  const t = id || peekActiveTarget();
  if (t === "test") return true;
  if (t === "prod") return hqWritesEnabled();
  return false;
}

function decodeSqlSecret(b64Key: string, plainKey: string) {
  const b64 = (process.env[b64Key] || "").trim();
  if (b64) {
    try {
      return Buffer.from(b64, "base64").toString("utf8");
    } catch {
      /* fall through */
    }
  }
  let p = process.env[plainKey] || "";
  p = p.trim().replace(/^['"]|['"]$/g, "");
  p = p.replace(/\\\$/g, "$").replace(/\$\$/g, "$");
  return p;
}

export function sqlPassword() {
  // Base64 preferred: Next/@next/env expands $2, $VAR, etc. and corrupts passwords
  return decodeSqlSecret("PAYDISK_SQL_PASSWORD_B64", "PAYDISK_SQL_PASSWORD");
}

/** Dedicated write login for 155 (falls back to read login if unset). */
export function sqlWriteUser() {
  return (
    (process.env.PAYDISK_SQL_WRITE_USER || "").trim() ||
    SQL_USER
  );
}

export function sqlWritePassword() {
  const dedicated = decodeSqlSecret(
    "PAYDISK_SQL_WRITE_PASSWORD_B64",
    "PAYDISK_SQL_WRITE_PASSWORD",
  );
  return dedicated || sqlPassword();
}

function encryptFor(target: DbTargetId) {
  // 155 often has Force Encryption off — Tedious encrypt:true then ends as "socket hang up".
  // Override per target: PAYDISK_SQL_PROD_ENCRYPT / PAYDISK_SQL_REPLICA_ENCRYPT
  if (target === "prod") {
    const v = process.env.PAYDISK_SQL_PROD_ENCRYPT;
    if (v === "true") return true;
    if (v === "false") return false;
    return false;
  }
  if (target === "replica") {
    const v = process.env.PAYDISK_SQL_REPLICA_ENCRYPT;
    if (v === "true") return true;
    if (v === "false") return false;
  }
  return SQL_ENCRYPT;
}

export function sqlReplicaPassword() {
  const dedicated = decodeSqlSecret(
    "PAYDISK_SQL_REPLICA_PASSWORD_B64",
    "PAYDISK_SQL_REPLICA_PASSWORD",
  );
  return dedicated || sqlPassword();
}

export function tediousConfigFor(target: DbTargetId) {
  const meta = DB_TARGETS[target];
  if (meta.auth !== "sql") return null;
  const password =
    target === "replica" ? sqlReplicaPassword() : sqlPassword();
  if (!meta.user || !password) return null;
  return {
    server: meta.host,
    port: meta.port,
    database: meta.database,
    user: meta.user,
    password,
    options: {
      encrypt: encryptFor(target),
      trustServerCertificate: SQL_TRUST,
    },
  };
}

/** SQL login used for INSERT / Calculate* on writable HQ targets. */
export function tediousWriteConfigFor(target: DbTargetId) {
  const meta = DB_TARGETS[target];
  if (meta.auth !== "sql") return null;
  if (!targetAllowsWrites(target)) return null;
  const user = sqlWriteUser();
  const password = sqlWritePassword();
  if (!user || !password) return null;
  return {
    server: meta.host,
    port: meta.port,
    database: meta.database,
    user,
    password,
    options: {
      encrypt: encryptFor(target),
      trustServerCertificate: SQL_TRUST,
    },
  };
}

export function windowsConnectionString() {
  return TEST_DB.connectionString;
}

/** Active host/db summary used by older call sites */
export function getActiveDbInfo() {
  const m = getTargetMeta();
  return {
    host: m.host,
    database: m.database,
    port: m.port,
    user: m.user,
    encrypt: SQL_ENCRYPT,
    trustServerCertificate: SQL_TRUST,
  };
}

export function mostamaryPoolConfig() {
  const id = peekActiveTarget();
  if (id === "test") return null;
  return tediousConfigFor(id);
}

export function mostamaryConnectionString() {
  if (isLabDb()) return windowsConnectionString();
  if (process.env.PAYDISK_SQL_CONNECTION) return process.env.PAYDISK_SQL_CONNECTION;
  const cfg = tediousConfigFor(peekActiveTarget());
  if (!cfg) return null;
  return [
    `Server=${cfg.server},${cfg.port}`,
    `Database=${cfg.database}`,
    `User Id=${cfg.user}`,
    `Password=${cfg.password}`,
    `Encrypt=${cfg.options.encrypt}`,
    `TrustServerCertificate=${cfg.options.trustServerCertificate}`,
  ].join(";");
}

export function getActiveDbLabel() {
  const m = getTargetMeta();
  return `${m.host}/${m.database}`;
}
