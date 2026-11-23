import {
  getWritePool,
  getReadPool,
  getSchemaCaps,
  sql,
  LAB_CALC_REQUEST_TIMEOUT_MS,
  refreshLabPool,
  targetAllowsWrites,
  getActiveDbLabel,
} from "@/lib/db/pool";
import { assertSqlProc, type AllowedSqlProc } from "@/lib/worker/whitelist";
import {
  draftProcName,
  isCalcDraftEnabled,
  resolveYaranePayTable,
  yaraneDraftHasRows,
  yaraneLiveHasRows,
} from "@/lib/lab/calc-draft";
import {
  parseYaraneExportIbnScope,
  yaraneIbnScopeSql,
  YARANE_ARMAGHAN_LIST_COLS,
  YARANE_ARMAGHAN_LIST_SELECT,
} from "@/lib/lab/yarane-export";

/** True when the active DB may create/calculate/mark list (lab or HQ writes). */
export function labWritesEnabled() {
  return targetAllowsWrites();
}

export type LabAction =
  | "calculate_yarane"
  | "mark_list"
  | "clear_list"
  | "mark_bank"
  | "clear_bank"
  | "exec_proc";

function requireLab() {
  if (!targetAllowsWrites()) {
    throw new Error(
      `Write/EXEC روی «${getActiveDbLabel()}» مجاز نیست — lab یا تولید (155) با دسترسی نوشتن`,
    );
  }
}

/** EXEC CalculateMarakezYarane (_Draft when PAYDISK_CALC_DRAFT=true). */
export async function labCalculateYarane(trId: number, supplyLocationId: number) {
  requireLab();
  if (!Number.isFinite(trId) || trId <= 0) throw new Error("TransactionId نامعتبر");
  if (!Number.isFinite(supplyLocationId) || supplyLocationId <= 0) {
    throw new Error("SupplyLocationId نامعتبر");
  }
  // Live already written → dry-run only (no Draft INSERT).
  if (isCalcDraftEnabled() && (await yaraneLiveHasRows(trId))) {
    const pool = await getReadPool();
    const started = Date.now();
    const liveRs = await pool.request().input("id", sql.Int, trId).query(`
      SELECT COUNT(*) AS payedRows,
             COUNT(DISTINCT MakeOverSupplyLocationId) AS supplyCount
      FROM dbo.PayedMakeOvers WITH (NOLOCK)
      WHERE TransactionId = @id
    `);
    const payedRows = Number(liveRs.recordset[0]?.payedRows || 0);
    const supplyCount = Number(liveRs.recordset[0]?.supplyCount || 0);
    return {
      ok: true as const,
      action: "calculate_yarane" as const,
      dryRun: true as const,
      wrote: false as const,
      proc: "CalculateMarakezYarane_Draft",
      draft: true as const,
      trId,
      supplyLocationId,
      ms: Date.now() - started,
      rowsAffected: 0,
      payedRows,
      supplyCount,
      message: `محاسبه (بدون نوشتن): live از قبل ${payedRows.toLocaleString("fa-IR")} ردیف دارد — Draft نوشته نشد.`,
    };
  }

  const proc = draftProcName("CalculateMarakezYarane") as AllowedSqlProc;
  const exec = await labExecProc(proc, { trId, supplyLocationId });
  const payTable = await resolveYaranePayTable(trId);

  const pool = await getWritePool();
  const countReq = pool.request();
  countReq.input("id", sql.Int, trId);
  const cnt = await countReq.query(`
    SELECT COUNT(*) AS payedRows,
           COUNT(DISTINCT MakeOverSupplyLocationId) AS supplyCount
    FROM ${payTable}
    WHERE TransactionId = @id
  `);
  const payedRows = Number(cnt.recordset[0]?.payedRows || 0);
  const supplyCount = Number(cnt.recordset[0]?.supplyCount || 0);

  return {
    ok: true as const,
    action: "calculate_yarane" as const,
    proc,
    draft: isCalcDraftEnabled(),
    trId,
    supplyLocationId,
    ms: exec.ms,
    rowsAffected: exec.rowsAffected,
    payedRows,
    supplyCount,
    message: `${proc} اجرا شد — ${isCalcDraftEnabled() ? "پیش‌نویس" : "PayedMakeOvers"}=${payedRows}`,
  };
}

/** Whitelisted Calculate* SP (lab only). Long-running — 30 min request timeout. */
export async function labExecProc(
  proc: AllowedSqlProc,
  params: { trId: number; supplyLocationId?: number; syncIt?: boolean },
) {
  requireLab();
  assertSqlProc(proc);
  // Drop stale lab pool that still has the old 120s requestTimeout.
  await refreshLabPool();
  const pool = await getWritePool();
  const req = pool.request();
  req.timeout = LAB_CALC_REQUEST_TIMEOUT_MS;
  const started = Date.now();

  if (
    proc === "CalculateMarakezYarane" ||
    proc === "CalculateMarakezYarane_Draft"
  ) {
    if (!params.supplyLocationId) throw new Error("SupplyLocationId لازم است");
    req.input("TransactionId", sql.BigInt, params.trId);
    req.input("SupplyLocationId", sql.BigInt, params.supplyLocationId);
  } else if (proc === "PromoteYaraneDraft" || proc === "ClearYaraneDraft") {
    req.input("TransactionId", sql.BigInt, params.trId);
  } else if (proc === "ListExporMarakez") {
    // Prefer labListExporMarakez(); keep worker path working with generated name
    req.input("TranId", sql.BigInt, params.trId);
    req.input("FileName", sql.NVarChar(100), defaultLabListFile(params.trId));
  } else if (proc === "Export") {
    // Armaghan مستمری bank diskette — dbo.Export @name, @transactionId
    req.input("name", sql.NVarChar(100), defaultLabBankFile(params.trId));
    req.input("transactionId", sql.BigInt, params.trId);
  } else if (proc === "PromoteMostamariDraft") {
    req.input("TrId", sql.BigInt, params.trId);
    // IT sync is expensive — off unless caller explicitly passes syncIt: true.
    req.input("SyncIt", sql.Bit, params.syncIt === true ? 1 : 0);
  } else {
    // Calculate* / *_Draft / ClearMostamariDraft use @TrId
    req.input("TrId", sql.BigInt, params.trId);
  }

  let result: Awaited<ReturnType<typeof req.execute>>;
  // Always schema-qualify — avoids "Could not find stored procedure" if default schema ≠ dbo
  // (also safer across DROP/CREATE deploys on lab).
  const qualified = proc.includes(".") ? proc : `dbo.${proc}`;
  try {
    result = await req.execute(qualified);
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    if (/timeout|ETIMEOUT|Query timeout/i.test(raw)) {
      throw new Error(
        `${qualified} still running past ${LAB_CALC_REQUEST_TIMEOUT_MS / 60000} min client timeout. ` +
          `Check lab SQL for session on TrId=${params.trId}; if the SP finished, use "Skip calc (already done)" and open Report. Original: ${raw}`,
      );
    }
    if (/Could not find stored procedure/i.test(raw)) {
      throw new Error(
        `${qualified} یافت نشد روی هدف فعلی دیتابیس — آزمایشی (lab) را انتخاب کنید و مطمئن شوید SP دیپلوی شده است. Original: ${raw}`,
      );
    }
    throw err;
  }
  const rowsAffected = Array.isArray(result.rowsAffected)
    ? result.rowsAffected.reduce((a: number, b: number) => a + b, 0)
    : Number(result.rowsAffected || 0);

  return {
    ok: true as const,
    action: "exec_proc" as const,
    proc,
    trId: params.trId,
    supplyLocationId: params.supplyLocationId ?? null,
    ms: Date.now() - started,
    rowsAffected,
    message: `EXEC ${proc} OK (${Math.round((Date.now() - started) / 1000)}s)`,
  };
}

/** Mark Key2 as list-ready (lab stub filename, mirrors Armaghan CSV flag). */
export async function labUpdateKey2(trId: number, key2: string | null) {
  requireLab();
  const pool = await getWritePool();
  const req = pool.request();
  req.input("id", sql.BigInt, trId);
  req.input("key2", sql.NVarChar, key2);
  const started = Date.now();
  await req.query(`
    UPDATE dbo.MakeOverTransactions
    SET Key2 = @key2
    WHERE Id = @id
  `);
  return {
    ok: true as const,
    action: key2 ? ("mark_list" as const) : ("clear_list" as const),
    trId,
    key2,
    ms: Date.now() - started,
    message: key2 ? `لیست افراد تنظیم شد: ${key2}` : "لیست افراد پاک شد",
  };
}

/** Mark Key3 bank diskette flag (lab). */
export async function labUpdateKey3(trId: number, key3: string | null) {
  requireLab();
  const pool = await getWritePool();
  const req = pool.request();
  req.input("id", sql.BigInt, trId);
  req.input("key3", sql.NVarChar, key3);
  const started = Date.now();
  await req.query(`
    UPDATE dbo.MakeOverTransactions
    SET Key3 = @key3
    WHERE Id = @id
  `);
  return {
    ok: true as const,
    action: key3 ? ("mark_bank" as const) : ("clear_bank" as const),
    trId,
    key3,
    ms: Date.now() - started,
    message: key3 ? `دیسکت بانک تنظیم شد: ${key3}` : "دیسکت بانک پاک شد",
  };
}

/** Armaghan-style people-list token: `{guid}-Marakez-CSV-Zihesab-{trId}.csv` */
export function defaultLabListFile(trId: number) {
  const guid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}-${Math.random().toString(16).slice(2, 10)}-${Math.random().toString(16).slice(2, 14)}`;
  return `${guid.toLowerCase()}-Marakez-CSV-Zihesab-${trId}.csv`;
}

export function defaultLabBankFile(trId: number) {
  return `LAB-Bank-Disk-${trId}.dat`;
}

/** Create MakeOverTransactions row (lab) — equivalent to ارمغان «تراکنش جدید». */
export async function labCreateYaraneTransaction(opts: {
  title: string;
  date: string; // YYYY-MM-DD
  registrar?: string;
  description?: string;
  /**
   * کد محل تأمین — kept for the wizard response only.
   * Do NOT write it into Key1: Armaghan «محاسبه کلید» expects NULL/GUID,
   * not a supply id like «2». Supply is restored from PayedMakeOvers /
   * Description / UI after create.
   */
  supplyLocationId?: number;
}) {
  requireLab();
  const title = opts.title.trim();
  if (!title) throw new Error("عنوان تراکنش لازم است");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.date)) {
    throw new Error("تاریخ باید به صورت YYYY-MM-DD باشد");
  }

  const pool = await getWritePool();
  const started = Date.now();

  // Lab may have optional DefinitionId; prod/155 does not — use cached schema probe.
  const caps = await getSchemaCaps();
  const hasDefinitionId = caps.hasTxnDefinitionId;

  const supplyId =
    opts.supplyLocationId && opts.supplyLocationId > 0
      ? opts.supplyLocationId
      : null;

  // Match Armaghan create: Key1 stays NULL (GUID appears later in list/bank flow).
  const req = pool.request();
  req.input("title", sql.NVarChar, title);
  req.input("date", sql.NVarChar, opts.date);
  req.input("registrar", sql.NVarChar, opts.registrar || "پنل دیسکت پرداخت");
  req.input("description", sql.NVarChar, opts.description || null);

  const insertCols = [
    "Title",
    "Date",
    "Registrar",
    "RegistrationDateTime",
    "Description",
    "Key1",
    "Key2",
    "Key3",
    "Acceptor",
    ...(hasDefinitionId ? ["DefinitionId"] : []),
  ];
  const insertVals = [
    "@title",
    "CAST(@date AS date)",
    "@registrar",
    "CONVERT(nvarchar(100), GETDATE(), 120)",
    "@description",
    "NULL",
    "NULL",
    "NULL",
    "NULL",
    ...(hasDefinitionId ? ["NULL"] : []),
  ];

  const result = await req.query(`
    INSERT INTO dbo.MakeOverTransactions (${insertCols.join(", ")})
    OUTPUT INSERTED.Id, INSERTED.Title, INSERTED.Date, INSERTED.Registrar, INSERTED.RegistrationDateTime, INSERTED.Key1
    VALUES (${insertVals.join(", ")})
  `);

  const row = result.recordset[0];
  if (!row) throw new Error("ثبت تراکنش ناموفق");

  return {
    ok: true as const,
    action: "create_txn" as const,
    trId: Number(row.Id),
    title: row.Title as string,
    date: row.Date as string,
    registrar: row.Registrar as string | null,
    supplyLocationId: supplyId,
    ms: Date.now() - started,
    message: `تراکنش #${row.Id} ثبت شد`,
  };
}

function clampPage(page: number) {
  return Math.max(1, Number(page) || 1);
}
function clampPageSize(pageSize: number, fallback = 20) {
  return Math.min(50, Math.max(5, Number(pageSize) || fallback));
}

/** Review calculation result for wizard check step (paged sample). */
export async function labReviewYarane(
  trId: number,
  opts?: {
    page?: number;
    pageSize?: number;
    /** When false, only aggregates — no full sample table (بررسی صحت). */
    includeSample?: boolean;
  },
) {
  requireLab();
  const pool = await getWritePool();
  const page = clampPage(opts?.page ?? 1);
  const pageSize = clampPageSize(opts?.pageSize ?? 15);
  const offset = (page - 1) * pageSize;
  const includeSample = opts?.includeSample !== false;

  const payTable = await resolveYaranePayTable(trId);

  const hdr = pool.request();
  hdr.input("id", sql.BigInt, trId);
  const header = await hdr.query(`
    SELECT Id, Title, Date, Registrar, RegistrationDateTime, Key1, Key2, Key3
    FROM dbo.MakeOverTransactions WHERE Id = @id
  `);
  if (!header.recordset[0]) throw new Error("تراکنش یافت نشد");

  const agg = pool.request();
  agg.input("id", sql.Int, trId);
  const aggregates = await agg.query(`
    SELECT
      COUNT(*) AS payedRows,
      COUNT(DISTINCT MakeOverSupplyLocationId) AS supplyCount,
      SUM(ISNULL(LocalSubsidy,0) + ISNULL(UniverseSubsidy,0)) AS subsidySum
    FROM ${payTable} WITH (NOLOCK)
    WHERE TransactionId = @id
  `);

  const a = aggregates.recordset[0] || {};
  const payedRows = Number(a.payedRows || 0);
  const totalPages = Math.max(1, Math.ceil(payedRows / pageSize) || 1);

  if (payedRows === 0) {
    return {
      ok: true as const,
      trId,
      header: header.recordset[0],
      payedRows: 0,
      supplyCount: 0,
      subsidySum: 0,
      supplies: [],
      sampleRows: [] as Record<string, unknown>[],
      page,
      pageSize,
      total: 0,
      totalPages: 1,
      readyToApprove: false,
      message: "هنوز ردیف محاسبه‌ای نیست — محاسبه را اجرا کنید",
    };
  }

  const supplies = pool.request();
  supplies.input("id", sql.Int, trId);
  const supplyRows = await supplies.query(`
    SELECT TOP 20
      p.MakeOverSupplyLocationId AS Id,
      ISNULL(s.MakeOverSupplyLocationTitle, N'(نامشخص)') AS Title,
      COUNT(*) AS cnt
    FROM ${payTable} p WITH (NOLOCK)
    LEFT JOIN dbo.MakeOverSupplyLocation s WITH (NOLOCK)
      ON s.MakeOverSupplyLocationId = p.MakeOverSupplyLocationId
    WHERE p.TransactionId = @id
    GROUP BY p.MakeOverSupplyLocationId, s.MakeOverSupplyLocationTitle
    ORDER BY COUNT(*) DESC
  `);

  let sampleRows: Record<string, unknown>[] = [];
  if (includeSample) {
    const sample = pool.request();
    sample.input("id", sql.Int, trId);
    sample.input("offset", sql.Int, offset);
    sample.input("pageSize", sql.Int, pageSize);
    const sampleRs = await sample.query(`
      SELECT
        p.Id, Person.FirstName, Person.LastName, Person.NID,
        Center.CenterTitle, City.CityTitle, Province.ProvinceTitle,
        p.LocalSubsidy, p.UniverseSubsidy,
        p.MakeOverSupplyLocationId
      FROM ${payTable} AS p WITH (NOLOCK)
      INNER JOIN dbo.Person WITH (NOLOCK) ON p.PersonId = Person.ID
      INNER JOIN dbo.Center WITH (NOLOCK) ON p.CenterId = Center.CenterId
      INNER JOIN dbo.City WITH (NOLOCK) ON Center.CityID = City.CityId
      INNER JOIN dbo.Province WITH (NOLOCK) ON City.ProvinceId = Province.ProvinceId
      WHERE p.TransactionId = @id
      ORDER BY p.Id DESC
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `);
    sampleRows = sampleRs.recordset as Record<string, unknown>[];
  }

  return {
    ok: true as const,
    trId,
    header: header.recordset[0],
    payedRows,
    supplyCount: Number(a.supplyCount || 0),
    subsidySum: Number(a.subsidySum || 0),
    supplies: supplyRows.recordset,
    sampleRows,
    page,
    pageSize,
    total: payedRows,
    totalPages,
    readyToApprove: payedRows > 0,
    message: `${payedRows.toLocaleString("fa-IR")} ردیف محاسبه آماده بررسی است`,
  };
}

/** Person list with server-side pagination (ops-doc «تهیه لیست افراد»). */
export async function labYaranePersonList(
  trId: number,
  opts?: {
    page?: number;
    pageSize?: number;
    /** all | with-ibn | without-ibn — filter on Center.IBN */
    ibnScope?: "all" | "with-ibn" | "without-ibn";
  },
) {
  const ibnScope = parseYaraneExportIbnScope(opts?.ibnScope || "all");
  const ibnPred = yaraneIbnScopeSql(ibnScope);
  const pool = await getReadPool();
  const page = clampPage(opts?.page ?? 1);
  const pageSize = clampPageSize(opts?.pageSize ?? 25);
  const offset = (page - 1) * pageSize;
  const started = Date.now();

  const payTable = await resolveYaranePayTable(trId);
  const countReq = pool.request();
  countReq.timeout = 60_000;
  countReq.input("id", sql.Int, trId);
  // «همه»: count only pay table (no Center join). Filtered scopes keep Center.
  const countRs = await countReq.query(
    ibnScope === "all"
      ? `
    SELECT COUNT(*) AS total
    FROM ${payTable} WITH (NOLOCK)
    WHERE TransactionId = @id
  `
      : `
    SELECT COUNT(*) AS total
    FROM ${payTable} AS PayedMakeOvers WITH (NOLOCK)
    INNER JOIN dbo.Center WITH (NOLOCK)
      ON PayedMakeOvers.CenterId = Center.CenterId
    WHERE PayedMakeOvers.TransactionId = @id
      ${ibnPred}
  `,
  );
  const total = Number(countRs.recordset[0]?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);

  const req = pool.request();
  req.timeout = 60_000;
  req.input("id", sql.Int, trId);
  req.input("offset", sql.Int, offset);
  req.input("pageSize", sql.Int, pageSize);
  // Same 11 columns as Armaghan ListExporMarakez / diskette CSV
  const result = await req.query(`
    SELECT
      ${YARANE_ARMAGHAN_LIST_SELECT}
    FROM ${payTable} AS p WITH (NOLOCK)
    INNER JOIN dbo.Person AS per WITH (NOLOCK) ON per.ID = p.PersonId
    INNER JOIN dbo.Center AS cntr WITH (NOLOCK) ON cntr.CenterId = p.CenterId
    INNER JOIN dbo.City AS cit WITH (NOLOCK) ON cit.CityId = cntr.CityID
    INNER JOIN dbo.Province AS pr WITH (NOLOCK) ON pr.ProvinceId = cit.ProvinceId
    INNER JOIN dbo.CenterSubCatagory AS ssc WITH (NOLOCK)
      ON ssc.CenterSubCatagoryId = cntr.CenterSubCatagoryId
    WHERE p.TransactionId = @id
      ${ibnPred.replace(/Center\./g, "cntr.")}
    ORDER BY p.Id DESC
    OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
  `);
  return {
    ok: true as const,
    trId,
    ibnScope,
    ms: Date.now() - started,
    page,
    pageSize,
    total,
    totalPages,
    columns: [...YARANE_ARMAGHAN_LIST_COLS],
    rows: result.recordset as Record<string, unknown>[],
    message:
      ibnScope === "without-ibn"
        ? `${total.toLocaleString("fa-IR")} ردیف فاقد شبا · صفحه ${page}`
        : ibnScope === "with-ibn"
          ? `${total.toLocaleString("fa-IR")} ردیف با شبا · صفحه ${page}`
          : `${total.toLocaleString("fa-IR")} ردیف · صفحه ${page}`,
  };
}

/**
 * Read-only subsidy min/max rows for a supply location (paged).
 * Used by settings «مبالغ یارانه» — same table CalculateMarakezYarane reads.
 */
export async function labYaraneThresholds(
  supplyLocationId: number,
  opts?: { page?: number; pageSize?: number },
) {
  if (!Number.isFinite(supplyLocationId) || supplyLocationId <= 0) {
    throw new Error("SupplyLocationId نامعتبر");
  }
  const pool = await getReadPool();
  const page = clampPage(opts?.page ?? 1);
  const pageSize = clampPageSize(opts?.pageSize ?? 25);
  const offset = (page - 1) * pageSize;
  const started = Date.now();

  const countReq = pool.request();
  countReq.input("sid", sql.BigInt, supplyLocationId);
  const countRs = await countReq.query(`
    SELECT COUNT(*) AS total
    FROM dbo.MakeOverSupplyLocationCenterCatagory WITH (NOLOCK)
    WHERE MakeOverSupplyLocationId = @sid
  `);
  const total = Number(countRs.recordset[0]?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const req = pool.request();
  req.input("sid", sql.BigInt, supplyLocationId);
  req.input("offset", sql.Int, offset);
  req.input("pageSize", sql.Int, pageSize);
  const result = await req.query(`
    SELECT
      MakeOverSupplyLocationCenterCatagoryId,
      MakeOverSupplyLocationId,
      CenterSubCatagoryId,
      PermitNoName,
      NoNameMaxSubsidy,
      NoNameMinSubsidy,
      NormalMaxSubsidy,
      NormalMinSubsidy,
      MakeOverActivityId,
      Budget,
      SpecialCaseMinSubsidy,
      SpecialCaseMaxSubSidy,
      Rate
    FROM dbo.MakeOverSupplyLocationCenterCatagory WITH (NOLOCK)
    WHERE MakeOverSupplyLocationId = @sid
    ORDER BY MakeOverSupplyLocationCenterCatagoryId
    OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
  `);
  return {
    ok: true as const,
    supplyLocationId,
    ms: Date.now() - started,
    page,
    pageSize,
    total,
    totalPages,
    columns: result.recordset[0] ? Object.keys(result.recordset[0]) : [],
    rows: result.recordset as Record<string, unknown>[],
    message:
      total > 0
        ? `${total.toLocaleString("fa-IR")} ردیف مبلغ برای محل تأمین #${supplyLocationId}`
        : "مبلغی برای این محل تأمین یافت نشد",
  };
}

/**
 * Same path Armaghan uses via ListExporMarakez BCP:
 * \\sqlcluster\MSSQLSERVER\Docs\Documents\Diskette\{FileName}
 */
export const YARANE_DISKETTE_UNC =
  process.env.PAYDISK_YARANE_DISKETTE_UNC?.trim() ||
  String.raw`\\sqlcluster\MSSQLSERVER\Docs\Documents\Diskette`;

/**
 * EXEC ListExporMarakez @TranId, @FileName
 * — sets Key2 and BCP-exports CSV to the shared Diskette folder.
 */
export async function labListExporMarakez(trId: number, fileName?: string) {
  requireLab();
  if (!Number.isFinite(trId) || trId <= 0) {
    throw new Error("TransactionId نامعتبر");
  }
  const key2 = (fileName && fileName.trim()) || defaultLabListFile(trId);
  assertSqlProc("ListExporMarakez");
  await refreshLabPool();
  const pool = await getWritePool();
  const req = pool.request();
  req.timeout = LAB_CALC_REQUEST_TIMEOUT_MS;
  req.input("TranId", sql.BigInt, trId);
  req.input("FileName", sql.NVarChar(100), key2);
  const started = Date.now();
  try {
    await req.execute("ListExporMarakez");
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    if (/timeout|ETIMEOUT|Query timeout/i.test(raw)) {
      throw new Error(
        `ListExporMarakez بیش از ${LAB_CALC_REQUEST_TIMEOUT_MS / 60000} دقیقه طول کشید — ` +
          `ممکن است BCP هنوز روی SQL در حال اجرا باشد. Original: ${raw}`,
      );
    }
    throw err;
  }

  const keyRs = await pool
    .request()
    .input("id", sql.BigInt, trId)
    .query(`
      SELECT Key2
      FROM dbo.MakeOverTransactions WITH (NOLOCK)
      WHERE Id = @id
    `);
  const dbKey2 =
    keyRs.recordset[0]?.Key2 != null
      ? String(keyRs.recordset[0].Key2).trim()
      : "";
  const finalKey2 = dbKey2 || key2;
  const uncPath = `${YARANE_DISKETTE_UNC}\\${finalKey2}`;

  return {
    ok: true as const,
    action: "list_export_marakez" as const,
    proc: "ListExporMarakez" as const,
    trId,
    key2: finalKey2,
    uncPath,
    ms: Date.now() - started,
    message: `ListExporMarakez — Key2=${finalKey2} · ${uncPath}`,
  };
}

/**
 * Approve: write Armaghan CSV to Diskette UNC from Node (no xp_cmdshell),
 * then set Key2. Falls back to EXEC ListExporMarakez if UNC write fails.
 */
export async function labApproveYarane(trId: number) {
  requireLab();
  const review = await labReviewYarane(trId, { pageSize: 5 });
  if (!review.readyToApprove) {
    throw new Error("بدون ردیف محاسبه نمی‌توان تایید کرد");
  }

  // Promote draft → live PayedMakeOvers before Key2 / diskette (Armaghan path needs live).
  if (isCalcDraftEnabled() && (await yaraneDraftHasRows(trId))) {
    await labExecProc("PromoteYaraneDraft", { trId });
  }

  const key2 = defaultLabListFile(trId);
  const started = Date.now();
  let uncPath = `${YARANE_DISKETTE_UNC}\\${key2}`;
  let method: "unc-node" | "list-expor-marakez" = "unc-node";
  let bytes = 0;
  const errors: string[] = [];

  try {
    const { writeYaraneArmaghanDisketteFile } = await import(
      "@/lib/lab/yarane-export"
    );
    const written = await writeYaraneArmaghanDisketteFile(trId, key2);
    uncPath = written.uncPath;
    bytes = written.bytes;
    await labUpdateKey2(trId, key2);
  } catch (uncErr) {
    errors.push(uncErr instanceof Error ? uncErr.message : String(uncErr));
    try {
      const exported = await labListExporMarakez(trId, key2);
      method = "list-expor-marakez";
      uncPath = exported.uncPath;
    } catch (spErr) {
      errors.push(spErr instanceof Error ? spErr.message : String(spErr));
      throw new Error(
        `تایید ناموفق — نتوانستیم فایل را در مسیر ارمغان بنویسیم.\n` +
          `۱) نوشتن مستقیم Node روی UNC: ${errors[0]}\n` +
          `۲) ListExporMarakez/xp_cmdshell: ${errors[1] || "—"}\n` +
          `مسیر هدف: ${YARANE_DISKETTE_UNC}\\{FileName}\n` +
          `یا به حساب اجرای پنل دسترسی Write روی آن share بدهید، یا به behqlik دسترسی EXECUTE روی xp_cmdshell.`,
      );
    }
  }

  let downloadUrl: string | null = null;
  try {
    const { armaghanDisketteDownloadUrl } = await import(
      "@/lib/armaghan/get-list-makeover"
    );
    downloadUrl = armaghanDisketteDownloadUrl(key2);
  } catch {
    downloadUrl = null;
  }

  return {
    ok: true as const,
    action: "approve" as const,
    trId,
    key2,
    uncPath,
    downloadUrl,
    method,
    bytes,
    payedRows: review.payedRows,
    listMs: Date.now() - started,
    ms: Date.now() - started,
    message:
      method === "unc-node"
        ? `تایید شد — فایل روی مسیر ارمغان نوشته شد (${key2})`
        : `تایید شد — ListExporMarakez فایل را ساخت (${key2})`,
  };
}

/**
 * Safe cancel / revert for a یارانه txn:
 * 1) clear Key2/Key3 (finance gate)
 * 2) DELETE PayedMakeOvers for TrId
 * 3) DELETE header MakeOverTransactions (default)
 */
export async function labCancelYaraneTransaction(
  trId: number,
  opts?: { deleteHeader?: boolean },
) {
  requireLab();
  if (!Number.isFinite(trId) || trId <= 0) {
    throw new Error("شناسه تراکنش نامعتبر");
  }
  const deleteHeader = opts?.deleteHeader !== false;
  const pool = await getWritePool();
  const started = Date.now();

  if (isCalcDraftEnabled()) {
    try {
      await labExecProc("ClearYaraneDraft", { trId });
    } catch {
      /* empty draft ok */
    }
  }

  const hdr = await pool
    .request()
    .input("id", sql.BigInt, trId)
    .query(`
      SELECT Id, Title, Key2, Key3
      FROM dbo.MakeOverTransactions WITH (NOLOCK)
      WHERE Id = @id
    `);
  if (!hdr.recordset[0]) {
    throw new Error(`تراکنش #${trId} یافت نشد`);
  }

  const beforePayed = Number(
    (
      await pool
        .request()
        .input("id", sql.Int, trId)
        .query(`
          SELECT COUNT_BIG(*) AS c
          FROM dbo.PayedMakeOvers WITH (NOLOCK)
          WHERE TransactionId = @id
        `)
    ).recordset[0]?.c || 0,
  );

  await pool
    .request()
    .input("id", sql.BigInt, trId)
    .query(`
      UPDATE dbo.MakeOverTransactions
      SET Key2 = NULL, Key3 = NULL
      WHERE Id = @id
    `);

  const delPayed = await pool
    .request()
    .input("id", sql.Int, trId)
    .query(`
      DELETE FROM dbo.PayedMakeOvers
      WHERE TransactionId = @id
    `);
  const payedDeleted = Array.isArray(delPayed.rowsAffected)
    ? delPayed.rowsAffected.reduce((a, b) => a + b, 0)
    : Number(delPayed.rowsAffected || 0);

  let headerDeleted = false;
  if (deleteHeader) {
    const left = Number(
      (
        await pool
          .request()
          .input("id", sql.Int, trId)
          .query(`
            SELECT COUNT_BIG(*) AS c
            FROM dbo.PayedMakeOvers WITH (NOLOCK)
            WHERE TransactionId = @id
          `)
      ).recordset[0]?.c || 0,
    );
    if (left > 0) {
      throw new Error(
        `لغو ناقص: هنوز ${left} ردیف PayedMakeOvers مانده — هدر حذف نشد`,
      );
    }
    const delHdr = await pool
      .request()
      .input("id", sql.BigInt, trId)
      .query(`
        DELETE FROM dbo.MakeOverTransactions
        WHERE Id = @id
      `);
    headerDeleted =
      (Array.isArray(delHdr.rowsAffected)
        ? delHdr.rowsAffected.reduce((a, b) => a + b, 0)
        : Number(delHdr.rowsAffected || 0)) > 0;
  }

  return {
    ok: true as const,
    action: "cancel" as const,
    trId,
    title: hdr.recordset[0].Title != null ? String(hdr.recordset[0].Title) : null,
    beforePayedRows: beforePayed,
    payedDeleted,
    clearedKeys: true as const,
    headerDeleted,
    ms: Date.now() - started,
    message: headerDeleted
      ? `تراکنش #${trId} لغو شد — ${payedDeleted.toLocaleString("fa-IR")} ردیف محاسبه حذف و هدر پاک شد`
      : `علامت لیست/بانک و ${payedDeleted.toLocaleString("fa-IR")} ردیف محاسبه برای #${trId} پاک شد (هدر مانده)`,
  };
}
