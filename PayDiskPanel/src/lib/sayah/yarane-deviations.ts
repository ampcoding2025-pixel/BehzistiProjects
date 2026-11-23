import { getReadPool, sql } from "@/lib/db/pool";
import { resolveYaranePayTable } from "@/lib/lab/calc-draft";
import {
  customerHasShebaId,
  fixShebaId,
  normalizeNationalId,
  type SayahAccountOwnerType,
} from "@/lib/sayah/tatbigh";

export type YaraneShebaDeviationRow = {
  FirstName: string;
  LastName: string;
  NID: string;
  Center: string;
  Account: string;
  NationalId: string;
  ibn: string;
  IsPersonal: string;
  sayahDeviation: string;
  /** Present when searching across transactions (no trId). */
  TransactionId?: string;
};

/** Text filters for reports / tables (contains, case-insensitive via SQL LIKE). */
export type YaraneShebaDeviationFilters = {
  FirstName?: string;
  LastName?: string;
  NID?: string;
  Center?: string;
  Account?: string;
  NationalId?: string;
  ibn?: string;
  sayahDeviation?: string;
};

export function hasYaraneShebaReportTextFilter(
  filters?: YaraneShebaDeviationFilters | null,
): boolean {
  if (!filters) return false;
  return !!(
    String(filters.FirstName || "").trim() ||
    String(filters.LastName || "").trim() ||
    String(filters.NID || "").trim() ||
    String(filters.Center || "").trim() ||
    String(filters.Account || "").trim() ||
    String(filters.NationalId || "").trim() ||
    String(filters.ibn || "").trim()
  );
}

const MISSING_SHEBA_REASON =
  "فاقد شبا (در دیتابیس شبا/شماره قابل نرمال‌سازی نیست)";

function likeNeedle(raw?: string): string | null {
  const t = String(raw || "")
    .trim()
    .replace(/[%_\[\]]/g, "");
  return t ? `%${t}%` : null;
}

function rowMatchesFilters(
  row: YaraneShebaDeviationRow,
  filters?: YaraneShebaDeviationFilters,
): boolean {
  if (!filters) return true;
  const checks: Array<[keyof YaraneShebaDeviationFilters, string]> = [
    ["FirstName", row.FirstName],
    ["LastName", row.LastName],
    ["NID", row.NID],
    ["Center", row.Center],
    ["Account", row.Account],
    ["NationalId", row.NationalId],
    ["ibn", row.ibn],
    ["sayahDeviation", row.sayahDeviation],
  ];
  for (const [key, val] of checks) {
    const needle = String(filters[key] || "")
      .trim()
      .toLowerCase();
    if (!needle) continue;
    if (!String(val || "").toLowerCase().includes(needle)) return false;
  }
  return true;
}

/** SQL AND-clauses + bound inputs for person/center text filters (not sayahDeviation). */
function bindSqlPersonFilters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  req: { input: (name: string, type: unknown, value: unknown) => unknown },
  filters?: YaraneShebaDeviationFilters,
): string {
  const pairs: Array<[keyof YaraneShebaDeviationFilters, string]> = [
    ["FirstName", "per.FirstName"],
    ["LastName", "per.LastName"],
    ["NID", "per.NID"],
    ["Center", "cntr.CenterTitle"],
    ["Account", "p.CenterAccount"],
    ["NationalId", "cntr.NationalId"],
    ["ibn", "cntr.IBN"],
  ];
  const parts: string[] = [];
  for (const [key, col] of pairs) {
    const needle = likeNeedle(filters?.[key]);
    if (!needle) continue;
    const pname = `f_${key}`;
    req.input(pname, sql.NVarChar, needle);
    parts.push(`AND ${col} LIKE @${pname}`);
  }
  const devNeedle = String(filters?.sayahDeviation || "").trim().toLowerCase();
  if (devNeedle && !MISSING_SHEBA_REASON.toLowerCase().includes(devNeedle)) {
    // Missing-sheba rows cannot match this deviation text
    parts.push("AND 1=0");
  }
  return parts.join("\n        ");
}

type CenterHit = { CenterId: number; reason: string };

type DeviationCache = {
  /** Bump when Sheba normalize rules change so stale invalid-format rows refresh. */
  version: number;
  missingCenterIds: number[];
  badCenters: CenterHit[];
  fixedIrCount: number;
  invalidFormatCount: number;
  centersWithSheba: number;
  sayahChecked: number;
  sayahMatchCount: number;
  sayahMismatchCount: number;
  sayahErrorCount: number;
  ts: number;
};

/** In-process cache so pagination / list+check reuse Sayah results. */
const deviationCache = new Map<number, DeviationCache>();
const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_VERSION = 2; // v2: IR any-case + pad 22–23 digit Shebas
const SAYAH_CONCURRENCY = 8;

function clampPage(page: number) {
  return Math.max(1, Number(page) || 1);
}
function clampPageSize(pageSize: number, fallback = 5) {
  return Math.min(100, Math.max(1, Number(pageSize) || fallback));
}

function resolveCenterSheba(ibn: string | null, account: string | null) {
  const fromIbn = fixShebaId(ibn);
  if (fromIbn.sheba) {
    return {
      sheba: fromIbn.sheba,
      addedIr: fromIbn.addedIr,
      padded: fromIbn.padded,
      hadIr: fromIbn.hadIr,
      source: "ibn" as const,
    };
  }
  const fromAcc = fixShebaId(account);
  if (fromAcc.sheba) {
    return {
      sheba: fromAcc.sheba,
      addedIr: fromAcc.addedIr,
      padded: fromAcc.padded,
      hadIr: fromAcc.hadIr,
      source: "account" as const,
    };
  }
  return {
    sheba: null,
    addedIr: false,
    padded: false,
    hadIr: fromIbn.hadIr || fromAcc.hadIr,
    source: null as null,
  };
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  if (!items.length) return [];
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const idx = next++;
      if (idx >= items.length) return;
      results[idx] = await fn(items[idx]);
    }
  }
  const n = Math.min(Math.max(1, concurrency), items.length);
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}

/**
 * Deviations only for a یارانه txn — missing/invalid Sheba + CBI Sayah mismatches.
 * Sheba values without IR are normalized (IR prepended) before calling Sayah.
 * Sayah results are cached per txn so page changes and list/check reuse stay fast.
 */
export async function labYaraneShebaDeviations(
  trId: number,
  opts?: {
    page?: number;
    pageSize?: number;
    /** Max centers with resolvable Sheba to check via Sayah (REST). */
    sayahLimit?: number;
    /** Force a fresh Sayah pass (ignore cache). Default: true on page 1. */
    refreshSayah?: boolean;
    /** Optional column contains-filters (reports page). */
    filters?: YaraneShebaDeviationFilters;
    /** When true, skip فاقد-شبا rows — only Sayah/format mismatch people. */
    onlySayahMismatch?: boolean;
  },
) {
  if (!Number.isFinite(trId) || trId <= 0) {
    throw new Error("TransactionId نامعتبر");
  }
  const pool = await getReadPool();
  const page = clampPage(opts?.page ?? 1);
  const pageSize = clampPageSize(opts?.pageSize ?? 5);
  const sayahLimit = Math.min(200, Math.max(0, Number(opts?.sayahLimit) || 40));
  const refreshSayah = opts?.refreshSayah ?? page === 1;
  const filters = opts?.filters;
  const onlySayahMismatch = !!opts?.onlySayahMismatch;
  const started = Date.now();
  const payTable = await resolveYaranePayTable(trId);

  const cached = deviationCache.get(trId);
  const cacheFresh =
    !!cached &&
    cached.version === CACHE_VERSION &&
    Date.now() - cached.ts < CACHE_TTL_MS &&
    !refreshSayah;

  let missingCenterIds: number[];
  let badCenters: CenterHit[];
  let fixedIrCount: number;
  let invalidFormatCount: number;
  let centersWithSheba: number;
  let sayahChecked: number;
  let sayahMatchCount: number;
  let sayahMismatchCount: number;
  let sayahErrorCount: number;
  let fromCache = false;

  if (cacheFresh && cached) {
    fromCache = true;
    missingCenterIds = cached.missingCenterIds;
    badCenters = cached.badCenters;
    fixedIrCount = cached.fixedIrCount;
    invalidFormatCount = cached.invalidFormatCount;
    centersWithSheba = cached.centersWithSheba;
    sayahChecked = cached.sayahChecked;
    sayahMatchCount = cached.sayahMatchCount;
    sayahMismatchCount = cached.sayahMismatchCount;
    sayahErrorCount = cached.sayahErrorCount;
  } else {
    const centersReq = pool.request();
    centersReq.timeout = 90_000;
    centersReq.input("id", sql.Int, trId);
    const centersRs = await centersReq.query(`
      SELECT
        cntr.CenterId,
        LTRIM(RTRIM(cntr.CenterTitle)) AS CenterTitle,
        LTRIM(RTRIM(cntr.IBN)) AS ibn,
        LTRIM(RTRIM(cntr.Account)) AS CenterAccount,
        LTRIM(RTRIM(cntr.NationalId)) AS NationalId,
        ISNULL(cntr.IsPersonal, 0) AS IsPersonal,
        COUNT_BIG(*) AS payRows
      FROM ${payTable} AS p WITH (NOLOCK)
      INNER JOIN dbo.Center AS cntr WITH (NOLOCK) ON cntr.CenterId = p.CenterId
      WHERE p.TransactionId = @id
      GROUP BY
        cntr.CenterId,
        cntr.CenterTitle,
        cntr.IBN,
        cntr.Account,
        cntr.NationalId,
        cntr.IsPersonal
      ORDER BY COUNT_BIG(*) DESC
    `);

    missingCenterIds = [];
    badCenters = [];
    const toCheck: Array<{
      CenterId: number;
      sheba: string;
      addedIr: boolean;
      padded: boolean;
      NationalId: string;
      IsPersonal: number;
    }> = [];

    fixedIrCount = 0;
    invalidFormatCount = 0;

    for (const c of centersRs.recordset as Array<{
      CenterId: number;
      ibn: string | null;
      CenterAccount: string | null;
      NationalId: string | null;
      IsPersonal: number;
    }>) {
      const centerId = Number(c.CenterId);
      const resolved = resolveCenterSheba(c.ibn, c.CenterAccount);
      const raw = String(c.ibn || c.CenterAccount || "").trim();

      if (!resolved.sheba) {
        if (!raw || /^null$/i.test(raw)) {
          missingCenterIds.push(centerId);
        } else if (resolved.hadIr) {
          // Has ir/IR/Ir but still not 22–24 usable digits — length issue, not "case"
          invalidFormatCount += 1;
          badCenters.push({
            CenterId: centerId,
            reason: "شبا با پیشوند IR ولی تعداد ارقام نادرست است",
          });
        } else {
          invalidFormatCount += 1;
          badCenters.push({
            CenterId: centerId,
            reason: "فرمت شبا نامعتبر (حتی پس از افزودن IR)",
          });
        }
        continue;
      }

      if (resolved.addedIr) fixedIrCount += 1;
      toCheck.push({
        CenterId: centerId,
        sheba: resolved.sheba,
        addedIr: resolved.addedIr,
        padded: resolved.padded,
        NationalId: String(c.NationalId || ""),
        IsPersonal: Number(c.IsPersonal) || 0,
      });
    }

    centersWithSheba = toCheck.length;
    sayahChecked = 0;
    sayahMatchCount = 0;
    sayahMismatchCount = 0;
    sayahErrorCount = 0;

    const checkSlice = toCheck.slice(0, sayahLimit);
    if (checkSlice.length > 0) {
      const sayahHits = await mapPool(
        checkSlice,
        SAYAH_CONCURRENCY,
        async (c) => {
          const natRaw = String(c.NationalId || "").replace(/\D/g, "");
          if (!natRaw) {
            return {
              kind: "bad" as const,
              CenterId: c.CenterId,
              reason: "فاقد شناسه ملی/حقوقی مرکز",
            };
          }

          let accountOwnerType: SayahAccountOwnerType;
          let nationalId: string;
          let legalId: string;
          if (Number(c.IsPersonal) === 1) {
            accountOwnerType = "1";
            const nid = normalizeNationalId(natRaw);
            if (!nid) {
              return {
                kind: "bad" as const,
                CenterId: c.CenterId,
                reason: "کد ملی مرکز نامعتبر",
              };
            }
            nationalId = nid;
            legalId = "0";
          } else {
            accountOwnerType = "2";
            nationalId = "0";
            legalId = natRaw;
          }

          const result = await customerHasShebaId(
            {
              accountOwnerType,
              nationalId,
              legalId,
              shebaId: c.sheba,
            },
            { timeoutMs: 12_000, mode: "rest" },
          );

          const irNote = c.addedIr
            ? " (IR افزوده‌شد)"
            : c.padded
              ? " (رقم صفر ابتدایی تکمیل شد)"
              : "";

          if (result.matched === true) {
            return { kind: "match" as const, CenterId: c.CenterId };
          }

          if (result.matched === false) {
            return {
              kind: "mismatch" as const,
              CenterId: c.CenterId,
              reason:
                result.message && result.message !== "OK"
                  ? `عدم تطبیق سیاح: ${result.message}${irNote}`
                  : `عدم تطبیق شبا با شناسه در سیاح${irNote}`,
            };
          }

          const errDetail =
            result.errors?.[0]?.ErrorDsc || result.message || "خطای سرویس سیاح";
          return {
            kind: "error" as const,
            CenterId: c.CenterId,
            reason: `خطای سیاح: ${errDetail}${irNote}`,
          };
        },
      );

      for (const hit of sayahHits) {
        if (hit.kind === "match") {
          sayahChecked += 1;
          sayahMatchCount += 1;
          continue;
        }
        if (hit.kind === "bad") {
          badCenters.push({ CenterId: hit.CenterId, reason: hit.reason });
          continue;
        }
        sayahChecked += 1;
        if (hit.kind === "mismatch") {
          sayahMismatchCount += 1;
        } else {
          sayahErrorCount += 1;
        }
        badCenters.push({ CenterId: hit.CenterId, reason: hit.reason });
      }
    }

    deviationCache.set(trId, {
      version: CACHE_VERSION,
      missingCenterIds,
      badCenters,
      fixedIrCount,
      invalidFormatCount,
      centersWithSheba,
      sayahChecked,
      sayahMatchCount,
      sayahMismatchCount,
      sayahErrorCount,
      ts: Date.now(),
    });
  }

  async function peopleForCenters(
    ids: number[],
    reasonById: Map<number, string>,
    top: number,
  ): Promise<YaraneShebaDeviationRow[]> {
    if (!ids.length) return [];
    const list = ids.join(",");
    const peopleReq = pool.request();
    peopleReq.timeout = 60_000;
    peopleReq.input("id", sql.Int, trId);
    const peopleRs = await peopleReq.query(`
      SELECT TOP (${top})
        per.FirstName AS FirstName,
        per.LastName AS LastName,
        per.NID AS NID,
        cntr.CenterTitle AS Center,
        p.CenterAccount AS Account,
        LTRIM(RTRIM(cntr.NationalId)) AS NationalId,
        LTRIM(RTRIM(cntr.IBN)) AS ibn,
        LTRIM(STR(ISNULL(cntr.IsPersonal, 0))) AS IsPersonal,
        cntr.CenterId AS CenterId
      FROM ${payTable} AS p WITH (NOLOCK)
      INNER JOIN dbo.Person AS per WITH (NOLOCK) ON per.ID = p.PersonId
      INNER JOIN dbo.Center AS cntr WITH (NOLOCK) ON cntr.CenterId = p.CenterId
      WHERE p.TransactionId = @id
        AND cntr.CenterId IN (${list})
      ORDER BY p.Id DESC
    `);
    return (peopleRs.recordset as Array<Record<string, unknown>>).map((r) => ({
      FirstName: String(r.FirstName || ""),
      LastName: String(r.LastName || ""),
      NID: String(r.NID || ""),
      Center: String(r.Center || ""),
      Account: String(r.Account || ""),
      NationalId: String(r.NationalId || ""),
      ibn: String(r.ibn || ""),
      IsPersonal: String(r.IsPersonal || ""),
      sayahDeviation: reasonById.get(Number(r.CenterId)) || "مغایرت شبا",
    }));
  }

  let missingCount = 0;
  if (!onlySayahMismatch && missingCenterIds.length) {
    const countReq = pool.request();
    countReq.timeout = 60_000;
    countReq.input("id", sql.Int, trId);
    const list = missingCenterIds.join(",");
    const filterSql = bindSqlPersonFilters(countReq, filters);
    const countRs = await countReq.query(`
      SELECT COUNT(*) AS total
      FROM ${payTable} AS p WITH (NOLOCK)
      INNER JOIN dbo.Person AS per WITH (NOLOCK) ON per.ID = p.PersonId
      INNER JOIN dbo.Center AS cntr WITH (NOLOCK) ON cntr.CenterId = p.CenterId
      WHERE p.TransactionId = @id AND p.CenterId IN (${list})
        ${filterSql}
    `);
    missingCount = Number(countRs.recordset[0]?.total || 0);
  }

  const reasonById = new Map(
    badCenters.map((b) => [b.CenterId, b.reason] as const),
  );
  const sayahPeopleRaw = await peopleForCenters(
    badCenters.map((b) => b.CenterId),
    reasonById,
    500,
  );
  const sayahPeople = sayahPeopleRaw.filter((r) =>
    rowMatchesFilters(r, filters),
  );
  const sayahPeopleCount = sayahPeople.length;
  const total = missingCount + sayahPeopleCount;
  const totalPages = Math.max(1, Math.ceil(Math.max(total, 1) / pageSize));
  const start = (page - 1) * pageSize;

  const rows: YaraneShebaDeviationRow[] = [];
  let need = pageSize;

  if (
    !onlySayahMismatch &&
    need > 0 &&
    start < missingCount &&
    missingCenterIds.length
  ) {
    const missOffset = start;
    const missTake = Math.min(need, missingCount - missOffset);
    const list = missingCenterIds.join(",");
    const missingReq = pool.request();
    missingReq.timeout = 90_000;
    missingReq.input("id", sql.Int, trId);
    missingReq.input("offset", sql.Int, missOffset);
    missingReq.input("pageSize", sql.Int, missTake);
    const filterSql = bindSqlPersonFilters(missingReq, filters);
    const missingRs = await missingReq.query(`
      SELECT
        per.FirstName AS FirstName,
        per.LastName AS LastName,
        per.NID AS NID,
        cntr.CenterTitle AS Center,
        p.CenterAccount AS Account,
        LTRIM(RTRIM(cntr.NationalId)) AS NationalId,
        LTRIM(RTRIM(cntr.IBN)) AS ibn,
        LTRIM(STR(ISNULL(cntr.IsPersonal, 0))) AS IsPersonal
      FROM ${payTable} AS p WITH (NOLOCK)
      INNER JOIN dbo.Person AS per WITH (NOLOCK) ON per.ID = p.PersonId
      INNER JOIN dbo.Center AS cntr WITH (NOLOCK) ON cntr.CenterId = p.CenterId
      WHERE p.TransactionId = @id AND p.CenterId IN (${list})
        ${filterSql}
      ORDER BY p.Id DESC
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `);
    for (const r of missingRs.recordset as Array<Record<string, unknown>>) {
      rows.push({
        FirstName: String(r.FirstName || ""),
        LastName: String(r.LastName || ""),
        NID: String(r.NID || ""),
        Center: String(r.Center || ""),
        Account: String(r.Account || ""),
        NationalId: String(r.NationalId || ""),
        ibn: String(r.ibn || ""),
        IsPersonal: String(r.IsPersonal || ""),
        sayahDeviation: MISSING_SHEBA_REASON,
      });
    }
    need -= rows.length;
  }

  if (need > 0 && sayahPeopleCount > 0) {
    const sayahStart = Math.max(0, start - missingCount);
    if (sayahStart < sayahPeopleCount) {
      rows.push(...sayahPeople.slice(sayahStart, sayahStart + need));
    }
  }

  const sayahIssueCenters =
    sayahMismatchCount + sayahErrorCount + invalidFormatCount;
  const cacheNote = fromCache ? " · از کش" : "";

  return {
    ok: true as const,
    trId,
    page,
    pageSize,
    total,
    totalPages,
    missingCount,
    invalidFormatCount,
    fixedIrCount,
    centersWithSheba,
    sayahChecked,
    sayahMatchCount,
    sayahMismatchCount,
    sayahErrorCount,
    fromCache,
    columns: [
      "FirstName",
      "LastName",
      "NID",
      "Center",
      "Account",
      "NationalId",
      "ibn",
      "sayahDeviation",
    ],
    rows,
    ms: Date.now() - started,
    message:
      total === 0 && sayahIssueCenters === 0
        ? `مغایرت شبایی یافت نشد · ${sayahChecked.toLocaleString("fa-IR")} مرکز در سیاح تطبیق شد${fixedIrCount ? ` · ${fixedIrCount.toLocaleString("fa-IR")} شبا با افزودن IR` : ""}${cacheNote}`
        : `${total.toLocaleString("fa-IR")} ردیف مغایرت · صفحه ${page.toLocaleString("fa-IR")} از ${totalPages.toLocaleString("fa-IR")} (فاقد شبا: ${missingCount.toLocaleString("fa-IR")} · مشکل سیاح/فرمت: ${sayahIssueCenters.toLocaleString("fa-IR")}${fixedIrCount ? ` · IR اضافه‌شده: ${fixedIrCount.toLocaleString("fa-IR")}` : ""})${cacheNote}`,
  };
}

export function clearYaraneDeviationCache(trId?: number) {
  if (trId == null) deviationCache.clear();
  else deviationCache.delete(trId);
}

const MISSING_IBN_PRED = `(cntr.IBN IS NULL OR LTRIM(RTRIM(cntr.IBN)) = N'' OR LOWER(LTRIM(RTRIM(cntr.IBN))) = N'null')`;

async function checkCentersViaSayah(
  toCheck: Array<{
    CenterId: number;
    sheba: string;
    addedIr: boolean;
    NationalId: string;
    IsPersonal: number;
  }>,
) {
  let sayahChecked = 0;
  let sayahMatchCount = 0;
  let sayahMismatchCount = 0;
  let sayahErrorCount = 0;
  const badCenters: CenterHit[] = [];

  if (!toCheck.length) {
    return {
      badCenters,
      sayahChecked,
      sayahMatchCount,
      sayahMismatchCount,
      sayahErrorCount,
    };
  }

  const sayahHits = await mapPool(toCheck, SAYAH_CONCURRENCY, async (c) => {
    const natRaw = String(c.NationalId || "").replace(/\D/g, "");
    if (!natRaw) {
      return {
        kind: "bad" as const,
        CenterId: c.CenterId,
        reason: "فاقد شناسه ملی/حقوقی مرکز",
      };
    }

    let accountOwnerType: SayahAccountOwnerType;
    let nationalId: string;
    let legalId: string;
    if (Number(c.IsPersonal) === 1) {
      accountOwnerType = "1";
      const nid = normalizeNationalId(natRaw);
      if (!nid) {
        return {
          kind: "bad" as const,
          CenterId: c.CenterId,
          reason: "کد ملی مرکز نامعتبر",
        };
      }
      nationalId = nid;
      legalId = "0";
    } else {
      accountOwnerType = "2";
      nationalId = "0";
      legalId = natRaw;
    }

    const result = await customerHasShebaId(
      {
        accountOwnerType,
        nationalId,
        legalId,
        shebaId: c.sheba,
      },
      { timeoutMs: 12_000, mode: "rest" },
    );

    const irNote = c.addedIr ? " (IR افزوده‌شد)" : "";

    if (result.matched === true) {
      return { kind: "match" as const, CenterId: c.CenterId };
    }

    if (result.matched === false) {
      return {
        kind: "mismatch" as const,
        CenterId: c.CenterId,
        reason:
          result.message && result.message !== "OK"
            ? `عدم تطبیق سیاح: ${result.message}${irNote}`
            : `عدم تطبیق شبا با شناسه در سیاح${irNote}`,
      };
    }

    const errDetail =
      result.errors?.[0]?.ErrorDsc || result.message || "خطای سرویس سیاح";
    return {
      kind: "error" as const,
      CenterId: c.CenterId,
      reason: `خطای سیاح: ${errDetail}${irNote}`,
    };
  });

  for (const hit of sayahHits) {
    if (hit.kind === "match") {
      sayahChecked += 1;
      sayahMatchCount += 1;
      continue;
    }
    if (hit.kind === "bad") {
      badCenters.push({ CenterId: hit.CenterId, reason: hit.reason });
      continue;
    }
    sayahChecked += 1;
    if (hit.kind === "mismatch") sayahMismatchCount += 1;
    else sayahErrorCount += 1;
    badCenters.push({ CenterId: hit.CenterId, reason: hit.reason });
  }

  return {
    badCenters,
    sayahChecked,
    sayahMatchCount,
    sayahMismatchCount,
    sayahErrorCount,
  };
}

/**
 * Cross-transaction report (no trId) — filter by person/center fields.
 * Requires at least one text filter. Optional Sayah mismatch mode.
 */
export async function labYaraneShebaDeviationsCrossTxn(opts: {
  page?: number;
  pageSize?: number;
  sayahLimit?: number;
  filters?: YaraneShebaDeviationFilters;
  onlySayahMismatch?: boolean;
}) {
  const filters = opts.filters;
  if (!hasYaraneShebaReportTextFilter(filters)) {
    throw new Error(
      "بدون شناسه تراکنش، حداقل یک فیلتر (نام، کد ملی، مرکز، …) لازم است",
    );
  }

  const pool = await getReadPool();
  const page = clampPage(opts.page ?? 1);
  const pageSize = clampPageSize(opts.pageSize ?? 15);
  const sayahLimit = Math.min(80, Math.max(0, Number(opts.sayahLimit) || 40));
  const onlySayahMismatch = !!opts.onlySayahMismatch;
  const started = Date.now();

  const columns = [
    "TransactionId",
    "FirstName",
    "LastName",
    "NID",
    "Center",
    "Account",
    "NationalId",
    "ibn",
    "sayahDeviation",
  ];

  if (!onlySayahMismatch) {
    const countReq = pool.request();
    countReq.timeout = 90_000;
    const filterSql = bindSqlPersonFilters(countReq, filters);
    const countRs = await countReq.query(`
      SELECT COUNT(*) AS total
      FROM dbo.PayedMakeOvers AS p WITH (NOLOCK)
      INNER JOIN dbo.Person AS per WITH (NOLOCK) ON per.ID = p.PersonId
      INNER JOIN dbo.Center AS cntr WITH (NOLOCK) ON cntr.CenterId = p.CenterId
      WHERE ${MISSING_IBN_PRED}
        ${filterSql}
    `);
    const total = Number(countRs.recordset[0]?.total || 0);
    const totalPages = Math.max(1, Math.ceil(Math.max(total, 1) / pageSize));
    const offset = (page - 1) * pageSize;

    const listReq = pool.request();
    listReq.timeout = 90_000;
    listReq.input("offset", sql.Int, offset);
    listReq.input("pageSize", sql.Int, pageSize);
    const listFilterSql = bindSqlPersonFilters(listReq, filters);
    const listRs = await listReq.query(`
      SELECT
        p.TransactionId AS TransactionId,
        per.FirstName AS FirstName,
        per.LastName AS LastName,
        per.NID AS NID,
        cntr.CenterTitle AS Center,
        p.CenterAccount AS Account,
        LTRIM(RTRIM(cntr.NationalId)) AS NationalId,
        LTRIM(RTRIM(cntr.IBN)) AS ibn,
        LTRIM(STR(ISNULL(cntr.IsPersonal, 0))) AS IsPersonal
      FROM dbo.PayedMakeOvers AS p WITH (NOLOCK)
      INNER JOIN dbo.Person AS per WITH (NOLOCK) ON per.ID = p.PersonId
      INNER JOIN dbo.Center AS cntr WITH (NOLOCK) ON cntr.CenterId = p.CenterId
      WHERE ${MISSING_IBN_PRED}
        ${listFilterSql}
      ORDER BY p.Id DESC
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `);

    const rows: YaraneShebaDeviationRow[] = (
      listRs.recordset as Array<Record<string, unknown>>
    ).map((r) => ({
      TransactionId: String(r.TransactionId ?? ""),
      FirstName: String(r.FirstName || ""),
      LastName: String(r.LastName || ""),
      NID: String(r.NID || ""),
      Center: String(r.Center || ""),
      Account: String(r.Account || ""),
      NationalId: String(r.NationalId || ""),
      ibn: String(r.ibn || ""),
      IsPersonal: String(r.IsPersonal || ""),
      sayahDeviation: MISSING_SHEBA_REASON,
    }));

    return {
      ok: true as const,
      trId: null as number | null,
      page,
      pageSize,
      total,
      totalPages,
      missingCount: total,
      invalidFormatCount: 0,
      fixedIrCount: 0,
      centersWithSheba: 0,
      sayahChecked: 0,
      sayahMatchCount: 0,
      sayahMismatchCount: 0,
      sayahErrorCount: 0,
      fromCache: false,
      columns,
      rows,
      ms: Date.now() - started,
      message:
        total === 0
          ? "با این فیلترها فاقد شبایی یافت نشد"
          : `${total.toLocaleString("fa-IR")} ردیف فاقد شبا · صفحه ${page.toLocaleString("fa-IR")} از ${totalPages.toLocaleString("fa-IR")} (بدون شناسه تراکنش)`,
    };
  }

  // onlySayahMismatch: sample centers matching filters that have a resolvable Sheba
  const centersReq = pool.request();
  centersReq.timeout = 90_000;
  const centersFilterSql = bindSqlPersonFilters(centersReq, {
    ...filters,
    sayahDeviation: undefined,
  });
  const centersRs = await centersReq.query(`
    SELECT DISTINCT TOP (${sayahLimit * 3})
      cntr.CenterId,
      LTRIM(RTRIM(cntr.IBN)) AS ibn,
      LTRIM(RTRIM(cntr.Account)) AS CenterAccount,
      LTRIM(RTRIM(cntr.NationalId)) AS NationalId,
      ISNULL(cntr.IsPersonal, 0) AS IsPersonal
    FROM dbo.PayedMakeOvers AS p WITH (NOLOCK)
    INNER JOIN dbo.Person AS per WITH (NOLOCK) ON per.ID = p.PersonId
    INNER JOIN dbo.Center AS cntr WITH (NOLOCK) ON cntr.CenterId = p.CenterId
    WHERE 1=1
      ${centersFilterSql}
    ORDER BY cntr.CenterId DESC
  `);

  const toCheck: Array<{
    CenterId: number;
    sheba: string;
    addedIr: boolean;
    NationalId: string;
    IsPersonal: number;
  }> = [];
  let invalidFormatCount = 0;
  let fixedIrCount = 0;
  const formatBad: CenterHit[] = [];

  for (const c of centersRs.recordset as Array<{
    CenterId: number;
    ibn: string | null;
    CenterAccount: string | null;
    NationalId: string | null;
    IsPersonal: number;
  }>) {
    const resolved = resolveCenterSheba(c.ibn, c.CenterAccount);
    if (!resolved.sheba) {
      if (resolved.hadIr) {
        invalidFormatCount += 1;
        formatBad.push({
          CenterId: Number(c.CenterId),
          reason: "شبا با پیشوند IR ولی تعداد ارقام نادرست است",
        });
      }
      continue;
    }
    if (resolved.addedIr) fixedIrCount += 1;
    toCheck.push({
      CenterId: Number(c.CenterId),
      sheba: resolved.sheba,
      addedIr: resolved.addedIr,
      NationalId: String(c.NationalId || ""),
      IsPersonal: Number(c.IsPersonal) || 0,
    });
    if (toCheck.length >= sayahLimit) break;
  }

  const sayah = await checkCentersViaSayah(toCheck);
  const badCenters = [...formatBad, ...sayah.badCenters];
  const reasonById = new Map(
    badCenters.map((b) => [b.CenterId, b.reason] as const),
  );

  if (!badCenters.length) {
    return {
      ok: true as const,
      trId: null as number | null,
      page,
      pageSize,
      total: 0,
      totalPages: 1,
      missingCount: 0,
      invalidFormatCount,
      fixedIrCount,
      centersWithSheba: toCheck.length,
      sayahChecked: sayah.sayahChecked,
      sayahMatchCount: sayah.sayahMatchCount,
      sayahMismatchCount: sayah.sayahMismatchCount,
      sayahErrorCount: sayah.sayahErrorCount,
      fromCache: false,
      columns,
      rows: [] as YaraneShebaDeviationRow[],
      ms: Date.now() - started,
      message: `مغایرت سیاح/فرمت یافت نشد · ${sayah.sayahChecked.toLocaleString("fa-IR")} مرکز بررسی شد`,
    };
  }

  const idList = badCenters.map((b) => b.CenterId).join(",");
  const countReq = pool.request();
  countReq.timeout = 60_000;
  const countFilterSql = bindSqlPersonFilters(countReq, {
    ...filters,
    sayahDeviation: undefined,
  });
  const countRs = await countReq.query(`
    SELECT COUNT(*) AS total
    FROM dbo.PayedMakeOvers AS p WITH (NOLOCK)
    INNER JOIN dbo.Person AS per WITH (NOLOCK) ON per.ID = p.PersonId
    INNER JOIN dbo.Center AS cntr WITH (NOLOCK) ON cntr.CenterId = p.CenterId
    WHERE cntr.CenterId IN (${idList})
      ${countFilterSql}
  `);
  const total = Number(countRs.recordset[0]?.total || 0);
  const totalPages = Math.max(1, Math.ceil(Math.max(total, 1) / pageSize));
  const offset = (page - 1) * pageSize;

  const listReq = pool.request();
  listReq.timeout = 60_000;
  listReq.input("offset", sql.Int, offset);
  listReq.input("pageSize", sql.Int, pageSize);
  const listFilterSql = bindSqlPersonFilters(listReq, {
    ...filters,
    sayahDeviation: undefined,
  });
  const listRs = await listReq.query(`
    SELECT
      p.TransactionId AS TransactionId,
      per.FirstName AS FirstName,
      per.LastName AS LastName,
      per.NID AS NID,
      cntr.CenterTitle AS Center,
      p.CenterAccount AS Account,
      LTRIM(RTRIM(cntr.NationalId)) AS NationalId,
      LTRIM(RTRIM(cntr.IBN)) AS ibn,
      LTRIM(STR(ISNULL(cntr.IsPersonal, 0))) AS IsPersonal,
      cntr.CenterId AS CenterId
    FROM dbo.PayedMakeOvers AS p WITH (NOLOCK)
    INNER JOIN dbo.Person AS per WITH (NOLOCK) ON per.ID = p.PersonId
    INNER JOIN dbo.Center AS cntr WITH (NOLOCK) ON cntr.CenterId = p.CenterId
    WHERE cntr.CenterId IN (${idList})
      ${listFilterSql}
    ORDER BY p.Id DESC
    OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
  `);

  const rows: YaraneShebaDeviationRow[] = (
    listRs.recordset as Array<Record<string, unknown>>
  ).map((r) => ({
    TransactionId: String(r.TransactionId ?? ""),
    FirstName: String(r.FirstName || ""),
    LastName: String(r.LastName || ""),
    NID: String(r.NID || ""),
    Center: String(r.Center || ""),
    Account: String(r.Account || ""),
    NationalId: String(r.NationalId || ""),
    ibn: String(r.ibn || ""),
    IsPersonal: String(r.IsPersonal || ""),
    sayahDeviation:
      reasonById.get(Number(r.CenterId)) || "مغایرت شبا",
  }));

  const sayahIssueCenters =
    sayah.sayahMismatchCount + sayah.sayahErrorCount + invalidFormatCount;

  return {
    ok: true as const,
    trId: null as number | null,
    page,
    pageSize,
    total,
    totalPages,
    missingCount: 0,
    invalidFormatCount,
    fixedIrCount,
    centersWithSheba: toCheck.length,
    sayahChecked: sayah.sayahChecked,
    sayahMatchCount: sayah.sayahMatchCount,
    sayahMismatchCount: sayah.sayahMismatchCount,
    sayahErrorCount: sayah.sayahErrorCount,
    fromCache: false,
    columns,
    rows,
    ms: Date.now() - started,
    message: `${total.toLocaleString("fa-IR")} ردیف مغایرت سیاح/فرمت · صفحه ${page.toLocaleString("fa-IR")} از ${totalPages.toLocaleString("fa-IR")} (مراکز مشکل‌دار: ${sayahIssueCenters.toLocaleString("fa-IR")} · بدون شناسه تراکنش)`,
  };
}
