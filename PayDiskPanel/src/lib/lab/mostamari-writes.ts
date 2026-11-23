import {
  getActiveDbLabel,
  getReadPool,
  getWritePool,
  sql,
  targetAllowsWrites,
} from "@/lib/db/pool";
import {
  mostamariBankFilename,
  writeMostamariArmaghanBankFile,
} from "@/lib/lab/mostamari-bank-export";
import {
  countMostamariOpsPayList,
  marhaleForMostamariTrId,
  queryMostamariOpsPayListPage,
} from "@/lib/lab/mostamari-ops-list";
import { MOSTAMARI_OPS_LIST_COLS } from "@/lib/mostamari/ops-list-cols";
import { defaultLabBankFile, labExecProc } from "@/lib/lab/writes";
import {
  draftProcName,
  isCalcDraftEnabled,
  mostamariDraftHasRows,
  mostamariLiveHasRows,
  resolveMostamariPayTable,
} from "@/lib/lab/calc-draft";
import {
  getMostamariType,
  inferMostamariType,
  type MostamariTypeId,
} from "@/lib/mostamari/types";
import { assertSqlProc, type AllowedSqlProc } from "@/lib/worker/whitelist";

function requireLab() {
  if (!targetAllowsWrites()) {
    throw new Error(
      `Write/EXEC مستمری روی «${getActiveDbLabel()}» مجاز نیست — lab یا تولید (155) با دسترسی نوشتن`,
    );
  }
}

function clampPage(page: number) {
  return Math.max(1, Number(page) || 1);
}
function clampPageSize(pageSize: number, fallback = 10) {
  return Math.min(50, Math.max(5, Number(pageSize) || fallback));
}

async function resolveRegistrarUserId(username: string | null | undefined) {
  const uid = (username || "").trim();
  if (!uid) return null;
  const pool = await getReadPool();
  const req = pool.request();
  req.input("uid", sql.NVarChar, uid);
  const rs = await req.query(`
    SELECT TOP 1 ID FROM dbo.[User]
    WHERE LOWER(LTRIM(RTRIM(UserID))) = LOWER(@uid)
  `);
  const id = Number(rs.recordset[0]?.ID);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/**
 * Header for a PayedTransaction.
 * Avoid COUNT_BIG(PayedContinusPayment) by default — it times out after Calculate* on lab.
 * Use hasPayed (EXISTS) unless opts.countRows is true.
 */
export async function getMostamariTransaction(
  trId: number,
  opts?: { countRows?: boolean },
) {
  if (!Number.isFinite(trId) || trId <= 0) throw new Error("TransactionId نامعتبر");
  const pool = await getReadPool();
  const req = pool.request();
  req.timeout = 60_000;
  req.input("id", sql.Int, trId);
  const payTable = await resolveMostamariPayTable(trId);
  const countExpr = opts?.countRows
    ? `ISNULL((
        SELECT COUNT_BIG(*) FROM ${payTable} p WITH (NOLOCK)
        WHERE p.TransactionId = t.Id
      ), 0)`
    : `CASE WHEN EXISTS (
        SELECT 1 FROM ${payTable} p WITH (NOLOCK)
        WHERE p.TransactionId = t.Id
      ) THEN 1 ELSE 0 END`;
  const rs = await req.query(`
    SELECT
      t.Id, t.Title, t.RegistrationDate, t.RelatedTo, t.UserRegistrarId, t.Description,
      t.Ky, t.Year, t.AcceptorUserId, t.AcceptanceDateTime,
      t.ListToken, t.FileName, t.ExportToken,
      ru.UserID AS Registrar,
      ${countExpr} AS payedRows
    FROM dbo.PayedTransaction t WITH (NOLOCK)
    LEFT JOIN dbo.[User] ru ON ru.ID = t.UserRegistrarId
    WHERE t.Id = @id
  `);
  const row = rs.recordset[0];
  if (!row) {
    throw new Error(
      "تراکنش مستمری در PayedTransaction یافت نشد — هدف دیتابیس (آزمایشی/155/157) را بررسی کنید",
    );
  }
  const ky = row.Ky != null ? String(row.Ky) : null;
  const title = (row.Title as string | null) || null;
  const description = (row.Description as string | null) || null;
  const inferred = inferMostamariType({ ky, title, description });
  const payedRows = Number(row.payedRows || 0);
  const registrationDate =
    (row.RegistrationDate as string | Date | null) || null;
  const relatedTo = (row.RelatedTo as string | Date | null) || null;
  /** Where current readable pay rows live — not the global PAYDISK_CALC_DRAFT flag. */
  const paySource: "live" | "draft" | "none" =
    payedRows <= 0
      ? "none"
      : payTable.includes("_Draft")
        ? "draft"
        : "live";
  return {
    ok: true as const,
    header: {
      Id: Number(row.Id),
      Title: title,
      RegistrationDate: registrationDate,
      RelatedTo: relatedTo,
      UserRegistrarId: row.UserRegistrarId != null ? Number(row.UserRegistrarId) : null,
      Registrar: (row.Registrar as string | null) || null,
      Description: description,
      Ky: ky,
      Year: row.Year != null ? String(row.Year) : null,
      AcceptorUserId: row.AcceptorUserId != null ? Number(row.AcceptorUserId) : null,
      AcceptanceDateTime: (row.AcceptanceDateTime as string | null) || null,
      ListToken: (row.ListToken as string | null) || null,
      FileName: (row.FileName as string | null) || null,
      ExportToken: (row.ExportToken as string | null) || null,
      payedRows,
      /** When countRows=false, payedRows is 0|1 presence only */
      payedRowsExact: !!opts?.countRows,
      paySource,
      payTable,
      typeId: inferred?.id || null,
      typeTitleFa: inferred?.titleFa || null,
      typeInferredFrom: ky
        ? ("ky" as const)
        : inferred
          ? ("title" as const)
          : null,
      approved: !!(row.AcceptorUserId || row.AcceptanceDateTime || row.Year),
      /** Period month from Year column when set (e.g. 140506). */
      yearMonth: row.Year != null ? String(row.Year).replace(/\D/g, "").slice(0, 6) : null,
    },
  };
}

/** INSERT PayedTransaction (lab). */
export async function labCreateMostamariTransaction(opts: {
  title: string;
  date: string; // YYYY-MM-DD
  username?: string | null;
  description?: string | null;
  typeId?: MostamariTypeId | null;
}) {
  requireLab();
  const title = opts.title.trim();
  if (!title) throw new Error("عنوان تراکنش لازم است");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.date)) {
    throw new Error("تاریخ باید به صورت YYYY-MM-DD باشد");
  }
  const type = opts.typeId ? getMostamariType(opts.typeId) : null;
  const registrarId = await resolveRegistrarUserId(opts.username);
  if (!registrarId) {
    throw new Error(
      "کاربر ثبت‌کننده در dbo.[User] یافت نشد — با همان UserID لاگین کنید",
    );
  }
  const description = (
    opts.description?.trim() ||
    type?.titleFa ||
    title
  ).slice(0, 500);
  const pool = await getWritePool();
  const started = Date.now();
  const req = pool.request();
  req.input("title", sql.NVarChar, title.slice(0, 100));
  req.input("date", sql.NVarChar, opts.date);
  req.input("desc", sql.NVarChar, description);
  req.input("uid", sql.BigInt, registrarId);

  // RelatedTo = دورهٔ پرداخت (NOT NULL date) — همان تاریخ تعریف تراکنش
  const result = await req.query(`
    INSERT INTO dbo.PayedTransaction (
      Title, RegistrationDate, UserRegistrarId, Description, RelatedTo,
      Ky, Year, AcceptorUserId, AcceptanceDateTime
    )
    OUTPUT INSERTED.Id, INSERTED.Title, INSERTED.RegistrationDate, INSERTED.RelatedTo
    VALUES (
      @title, CAST(@date AS date), @uid, @desc, CAST(@date AS date),
      NULL, NULL, NULL, NULL
    )
  `);
  const row = result.recordset[0];
  if (!row) throw new Error("ثبت تراکنش مستمری ناموفق");
  return {
    ok: true as const,
    action: "create" as const,
    trId: Number(row.Id),
    title: row.Title as string,
    date: row.RegistrationDate as string,
    typeId: type?.id || null,
    ms: Date.now() - started,
    message: `تراکنش مستمری #${row.Id} ثبت شد`,
  };
}

/** Supply filter for Calculate* / dry-run — matches draft SPs. */
function mostamariSupplySql(typeId: MostamariTypeId): string {
  switch (typeId) {
    case "mst-hadafmandi":
      return `(1,2,3,4,5,6,7,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,38)`;
    case "mst-emdad":
      return `(8)`;
    case "mst-hagh-spinal":
      return `(37)`;
    case "mst-hagh-family":
      return `(40)`;
    case "mst-base":
    default:
      return `(1,2,3,4,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,38)`;
  }
}

/**
 * Read-only: what Calculate*_Draft would insert now vs current live rows.
 * Used when live already written — calculate is allowed, writing Draft is not.
 */
export async function labDryRunMostamariCalc(
  trId: number,
  typeId: MostamariTypeId,
) {
  requireLab();
  const type = getMostamariType(typeId);
  if (!type) throw new Error("نوع مستمری نامعتبر");
  const supply = mostamariSupplySql(typeId);
  const pool = await getReadPool();
  const started = Date.now();
  const wouldRs = await pool.request().query(`
    SELECT COUNT_BIG(*) AS cnt,
           SUM(CONVERT(bigint, Money)) AS moneySum
    FROM dbo.ContinusPayment WITH (NOLOCK)
    WHERE ContinusPaymentSupplyLocationId IN ${supply}
  `);
  const liveRs = await pool.request().input("id", sql.Int, trId).query(`
    SELECT COUNT_BIG(*) AS cnt,
           SUM(CONVERT(bigint, Money)) AS moneySum
    FROM dbo.PayedContinusPayment WITH (NOLOCK)
    WHERE TransactionId = @id
  `);
  const wouldCnt = Number(wouldRs.recordset[0]?.cnt || 0);
  const wouldSum =
    wouldRs.recordset[0]?.moneySum == null
      ? null
      : Number(wouldRs.recordset[0].moneySum);
  const liveCnt = Number(liveRs.recordset[0]?.cnt || 0);
  const liveSum =
    liveRs.recordset[0]?.moneySum == null
      ? null
      : Number(liveRs.recordset[0].moneySum);
  const match =
    wouldCnt === liveCnt &&
    (wouldSum == null && liveSum == null
      ? true
      : Number(wouldSum) === Number(liveSum));
  const ms = Date.now() - started;
  const fmt = (n: number | null) =>
    n == null || !Number.isFinite(n) ? "—" : n.toLocaleString("en-US");
  return {
    ok: true as const,
    action: "calculate" as const,
    dryRun: true as const,
    wrote: false as const,
    typeId: type.id,
    ky: type.ky,
    draft: true as const,
    paySource: "live" as const,
    proc: `${type.proc}_Draft`,
    payedRows: liveCnt > 0 ? 1 : 0,
    wouldRows: wouldCnt,
    liveRows: liveCnt,
    wouldMoneySum: wouldSum,
    liveMoneySum: liveSum,
    match,
    ms,
    rowsAffected: 0,
    message: match
      ? `محاسبه (بدون نوشتن): نتیجهٔ امروز با live #${trId} یکی است — ردیف ${fmt(wouldCnt)}. Draft نوشته نشد.`
      : `محاسبه (بدون نوشتن): امروز ${fmt(wouldCnt)} ردیف / مبلغ ${fmt(wouldSum)} — live فعلی ${fmt(liveCnt)} / ${fmt(liveSum)}. Draft نوشته نشد چون live از قبل پر است.`,
  };
}

/** EXEC Calculate* (or *_Draft when PAYDISK_CALC_DRAFT=true). */
export async function labCalculateMostamari(trId: number, typeId: MostamariTypeId) {
  requireLab();
  const type = getMostamariType(typeId);
  if (!type) throw new Error("نوع مستمری نامعتبر");
  // Live already written → allow calculate as dry-run only (no Draft INSERT).
  if (isCalcDraftEnabled() && (await mostamariLiveHasRows(trId))) {
    return labDryRunMostamariCalc(trId, typeId);
  }
  const proc = draftProcName(type.proc) as AllowedSqlProc;
  const exec = await labExecProc(proc, { trId });
  const draft = isCalcDraftEnabled();
  // After a successful draft SP, trust write — avoid extra EXISTS/resolve round-trips
  // that compete with post-insert IO on ~1.5M rows.
  let hasPayed = 1;
  let paySource: "live" | "draft" | "none" = draft ? "draft" : "live";
  try {
    if (draft) {
      const ok = await mostamariDraftHasRows(trId);
      hasPayed = ok ? 1 : 0;
      paySource = ok ? "draft" : "none";
    } else {
      const after = await getMostamariTransaction(trId, { countRows: false });
      hasPayed = after.header.payedRows > 0 ? 1 : 0;
      paySource = after.header.paySource;
    }
  } catch {
    hasPayed = -1;
  }
  return {
    ...exec,
    action: "calculate" as const,
    dryRun: false as const,
    wrote: true as const,
    typeId: type.id,
    ky: type.ky,
    draft,
    paySource,
    proc,
    payedRows: hasPayed > 0 ? 1 : 0,
    message:
      hasPayed > 0
        ? `${proc} finished in ${Math.round(exec.ms / 1000)}s — ${paySource} rows ready (Report step)`
        : hasPayed < 0
          ? `${proc} finished — could not verify rows yet; open Report`
          : `${proc} finished but no pay rows found yet`,
  };
}

/** Ops-doc IBN duplicate check (read-only, any DB) — fast HAVING, capped. */
export async function mostamariIbnDuplicates(limit = 50) {
  const pool = await getReadPool();
  const top = Math.min(100, Math.max(1, limit));
  const req = pool.request();
  req.timeout = 45_000;
  const rs = await req.query(`
    SELECT TOP (${top})
      AccountNumber,
      COUNT_BIG(*) AS dupCount
    FROM dbo.IBN_AccountNumber WITH (NOLOCK)
    GROUP BY AccountNumber
    HAVING COUNT_BIG(*) > 1
    ORDER BY COUNT_BIG(*) DESC, AccountNumber
  `);
  const rows = rs.recordset as Record<string, unknown>[];
  return {
    ok: true as const,
    columns: rows[0] ? Object.keys(rows[0]) : ["AccountNumber", "dupCount"],
    rows,
    total: rows.length,
    checked: true,
    message:
      rows.length > 0
        ? `${rows.length.toLocaleString("fa-IR")} حساب تکراری در نمونه — قبل از پرداخت رفع کنید`
        : "حساب تکراری یافت نشد",
  };
}

const FAMILY_LABELS_FA: Record<number, string> = {
  1: "یک نفره",
  2: "دونفره",
  3: "سه نفره",
  4: "چهار نفره",
  5: "پنج نفره و بیشتر",
};

function familyBucketFromCount(n: number) {
  if (!Number.isFinite(n) || n <= 1) return 1;
  if (n === 2) return 2;
  if (n === 3) return 3;
  if (n === 4) return 4;
  return 5;
}

/**
 * One row per Money (ops Excel shape). Prefer FamilyCount on pay rows, then
 * definition Cost. If two Money values share a label (stale def / mixed years),
 * fall back to ascending Money rank so هر مبلغ یک بعد خانوار یکتا دارد.
 */
function buildFamilyMoneyReport(
  moneyRows: Array<{ cnt: number; Money: number; FamilyCount?: number }>,
  costToFamily: Map<number, number>,
) {
  const sorted = [...moneyRows].sort(
    (a, b) => Number(a.Money) - Number(b.Money),
  );

  const bySource = sorted.map((r) => {
    const Money = Number(r.Money) || 0;
    const cnt = Number(r.cnt) || 0;
    const fromRow =
      r.FamilyCount != null && Number.isFinite(Number(r.FamilyCount))
        ? Number(r.FamilyCount)
        : null;
    const fromDef = costToFamily.get(Money);
    let familyBucket: number | null = null;
    if (fromRow != null) familyBucket = familyBucketFromCount(fromRow);
    else if (fromDef != null) familyBucket = familyBucketFromCount(fromDef);
    return { Money, cnt, familyBucket, totalMoney: cnt * Money };
  });

  const buckets = bySource.map((r) => r.familyBucket);
  const hasGap = buckets.some((b) => b == null);
  const hasDup =
    !hasGap &&
    new Set(buckets.filter((b): b is number => b != null)).size !==
      buckets.length;
  const useRank = hasGap || hasDup;

  return bySource.map((r, i) => {
    const familyBucket = useRank
      ? Math.min(5, i + 1)
      : (r.familyBucket as number);
    return {
      familyBucket,
      familyLabel:
        FAMILY_LABELS_FA[familyBucket] ||
        `سایر (${r.Money.toLocaleString("fa-IR")})`,
      cnt: r.cnt,
      Money: r.Money,
      totalMoney: r.totalMoney,
    };
  });
}

/**
 * Money report (ops «گزارش مستمری»).
 * Default = light GROUP BY Money on PayedContinusPayment only (fast, Excel shape).
 * `includeAlive` adds Person.IsDead=0 filter (ops count script — slower on ~1.5M rows).
 */
export async function mostamariReview(
  trId: number,
  opts?: {
    page?: number;
    pageSize?: number;
    /** IsDead=0 money groups (slower — Person join). */
    includeAlive?: boolean;
    /** Include paged person sample (slower). */
    includeSample?: boolean;
  },
) {
  const pool = await getReadPool();
  const header = await getMostamariTransaction(trId, { countRows: false });
  const page = clampPage(opts?.page ?? 1);
  const pageSize = clampPageSize(opts?.pageSize ?? 10, 10);
  const offset = (page - 1) * pageSize;
  const includeAlive = !!opts?.includeAlive;
  const includeSample = !!opts?.includeSample;

  const payTable = await resolveMostamariPayTable(trId);
  const histReq = pool.request();
  histReq.timeout = 90_000;
  histReq.input("id", sql.Int, trId);
  // FamilyCount via MAX() — calc copies it from ContinusPayment; one Money → one size.
  const hist = await histReq.query(`
    SELECT COUNT_BIG(*) AS cnt, Money, MAX(FamilyCount) AS FamilyCount
    FROM ${payTable} WITH (NOLOCK)
    WHERE TransactionId = @id
    GROUP BY Money
    ORDER BY Money ASC
  `);

  let aliveHistogram: Array<{
    cnt: number;
    Money: number;
    FamilyCount?: number;
  }> = [];
  if (includeAlive) {
    const aliveReq = pool.request();
    aliveReq.timeout = 120_000;
    aliveReq.input("id", sql.Int, trId);
    // Ops count script shape: GROUP BY money (+ IsDead=0); FamilyCount for labels.
    const alive = await aliveReq.query(`
      SELECT COUNT_BIG(*) AS cnt, r.Money, MAX(r.FamilyCount) AS FamilyCount
      FROM ${payTable} AS r WITH (NOLOCK)
      INNER JOIN dbo.Person AS p WITH (NOLOCK)
        ON p.ID = r.PersonId AND p.IsDead = 0
      WHERE r.TransactionId = @id
      GROUP BY r.Money
      ORDER BY r.Money ASC
    `);
    aliveHistogram = alive.recordset as Array<{
      cnt: number;
      Money: number;
      FamilyCount?: number;
    }>;
  }

  let sampleRows: Record<string, unknown>[] = [];
  if (includeSample) {
    const sampleReq = pool.request();
    sampleReq.timeout = 60_000;
    sampleReq.input("id", sql.Int, trId);
    sampleReq.input("offset", sql.Int, offset);
    sampleReq.input("pageSize", sql.Int, pageSize);
    const sample = await sampleReq.query(`
      SELECT
        p.Id, p.PersonId, p.AccountNumber, p.Money, p.FamilyCount, p.SupplyLocationId,
        Person.NID, Person.FirstName, Person.LastName,
        Center.CenterTitle, City.CityTitle, Province.ProvinceTitle,
        LTRIM(RTRIM(i.IBN)) AS ibn
      FROM ${payTable} AS p WITH (NOLOCK)
      INNER JOIN dbo.Person WITH (NOLOCK) ON p.PersonId = Person.ID
      INNER JOIN dbo.Center WITH (NOLOCK) ON p.CenterRegistrarId = Center.CenterId
      INNER JOIN dbo.City WITH (NOLOCK) ON Center.CityID = City.CityId
      INNER JOIN dbo.Province WITH (NOLOCK) ON City.ProvinceId = Province.ProvinceId
      LEFT OUTER JOIN dbo.IBN_AccountNumber AS i WITH (NOLOCK)
        ON LTRIM(RTRIM(p.AccountNumber)) = LTRIM(RTRIM(i.AccountNumber))
      WHERE p.TransactionId = @id
      ORDER BY p.Id DESC
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `);
    sampleRows = sample.recordset as Record<string, unknown>[];
  }

  /** Tiny lookup: Cost → FamilyCount for Excel «بعد خانوار» labels. */
  const costToFamily = new Map<number, number>();
  try {
    const defReq = pool.request();
    defReq.timeout = 15_000;
    const defRs = await defReq.query(`
      SELECT FamilyCount, Cost
      FROM dbo.ContinusPaymentDefenition WITH (NOLOCK)
    `);
    for (const row of defRs.recordset as Array<{
      FamilyCount: number;
      Cost: number;
    }>) {
      const cost = Number(row.Cost);
      const fc = Number(row.FamilyCount);
      if (!Number.isFinite(cost) || !Number.isFinite(fc)) continue;
      const prev = costToFamily.get(cost);
      if (prev == null || fc < prev) costToFamily.set(cost, fc);
    }
  } catch {
    /* definition table missing on some peers — rank fallback still works */
  }

  const moneyHistogram = hist.recordset as Array<{
    cnt: number;
    Money: number;
    FamilyCount?: number;
  }>;
  const reportSource =
    includeAlive && aliveHistogram.length ? aliveHistogram : moneyHistogram;
  const familyMoneyReport = buildFamilyMoneyReport(reportSource, costToFamily);
  const familyAliveTotal = familyMoneyReport.reduce((a, r) => a + r.cnt, 0);
  const familyMoneyGrandTotal = familyMoneyReport.reduce(
    (a, r) => a + r.totalMoney,
    0,
  );

  const total = moneyHistogram.reduce((a, r) => a + Number(r.cnt || 0), 0);
  const totalPages = Math.max(1, Math.ceil(Math.max(total, 1) / pageSize) || 1);
  const ready = total > 0 || header.header.payedRows > 0;
  return {
    ok: true as const,
    trId,
    header: { ...header.header, payedRows: total || header.header.payedRows },
    moneyHistogram,
    aliveHistogram,
    familyMoneyReport,
    familyAliveTotal,
    familyMoneyGrandTotal,
    familyReportAliveOnly: includeAlive,
    sampleRows,
    page,
    pageSize,
    total,
    totalPages,
    readyToApprove: ready,
    message: ready
      ? `${total.toLocaleString("fa-IR")} ردیف محاسبه‌شده`
      : "هنوز ردیف محاسبه‌ای نیست — ابتدا محاسبه را اجرا کنید",
  };
}

/**
 * Lightweight progress probe while Calculate* runs.
 * Short timeout — if COUNT is slow, return rows=null (UI falls back to time-based %).
 */
export async function mostamariCalcProgress(trId: number) {
  if (!Number.isFinite(trId) || trId <= 0) throw new Error("TransactionId نامعتبر");
  const pool = await getReadPool();
  const req = pool.request();
  req.timeout = 5_000;
  req.input("id", sql.Int, trId);
  try {
    // Do NOT COUNT the draft/live pay table while INSERT runs — that slows the write.
    // Read status text only (Calculate*_Draft sets «پیش‌نویس آماده =N»).
    const rs = await req.query(`
      SELECT Description
      FROM dbo.PayedTransaction WITH (NOLOCK)
      WHERE Id = @id
    `);
    const desc = String(rs.recordset[0]?.Description || "");
    const m = desc.match(/آماده\s*=\s*([\d\s]+)/);
    const rows =
      m && m[1]
        ? Number(String(m[1]).replace(/\s/g, ""))
        : null;
    return {
      ok: true as const,
      trId,
      rows: rows != null && Number.isFinite(rows) ? rows : null,
      timedOut: false as const,
      description: desc || null,
    };
  } catch {
    return {
      ok: true as const,
      trId,
      rows: null as number | null,
      timedOut: true as const,
    };
  }
}

/**
 * Exact row count for a pay list (can be slow on large lab tables).
 * Kept separate from paging so «بارگذاری لیست» is not blocked by COUNT_BIG.
 */
export async function mostamariPaymentListCount(trId: number) {
  if (!Number.isFinite(trId) || trId <= 0) throw new Error("TransactionId نامعتبر");
  const total = await countMostamariOpsPayList(trId, "all");
  return {
    ok: true as const,
    trId,
    total,
    message:
      total > 0
        ? `${total.toLocaleString("fa-IR")} ردیف پرداخت`
        : "ردیفی برای این تراکنش نیست",
  };
}

/**
 * Ops «تهیه لیست مستمری بگیران» — paged preview for step 6.
 * Column aliases match the ops Excel SELECT (NIDMadadjo, sheba, Marhale, …).
 */
export async function mostamariPaymentList(
  trId: number,
  opts?: { page?: number; pageSize?: number },
) {
  if (!Number.isFinite(trId) || trId <= 0) throw new Error("TransactionId نامعتبر");
  const page = clampPage(opts?.page ?? 1);
  const pageSize = clampPageSize(opts?.pageSize ?? 10, 10);
  const offset = (page - 1) * pageSize;
  const marhale = await marhaleForMostamariTrId(trId);
  const { rows: fetched, listSource, ibnSource } =
    await queryMostamariOpsPayListPage({
      trId,
      offset,
      fetchN: pageSize + 1,
      marhale,
      ibnScope: "all",
    });

  const hasMore = fetched.length > pageSize;
  const rows = hasMore ? fetched.slice(0, pageSize) : fetched;
  const totalPages = hasMore ? page + 1 : Math.max(1, page);
  const minKnown = offset + rows.length;

  return {
    ok: true as const,
    trId,
    page,
    pageSize,
    hasMore,
    totalExact: false as const,
    total: minKnown,
    totalPages,
    columns: [...MOSTAMARI_OPS_LIST_COLS],
    rows,
    marhale,
    listSource,
    ibnSource,
    message:
      rows.length > 0
        ? `صفحه ${page.toLocaleString("fa-IR")} — ${rows.length.toLocaleString("fa-IR")} ردیف (شمارش کل در پس‌زمینه)`
        : page > 1
          ? "صفحه خالی است"
          : "ردیفی برای این تراکنش نیست — ابتدا محاسبه را انجام دهید",
  };
}

/** Read-only: people in A not in B (ops pair-sync preview). */
export async function mostamariPairDiff(
  trId: number,
  peerTrId: number,
  limit = 30,
) {
  if (!Number.isFinite(trId) || trId <= 0 || !Number.isFinite(peerTrId) || peerTrId <= 0) {
    throw new Error("Both transaction ids are required");
  }
  if (trId === peerTrId) throw new Error("Pair ids must differ");
  const top = Math.min(100, Math.max(5, limit));
  const pool = await getReadPool();
  const tableA = await resolveMostamariPayTable(trId);
  const tableB = await resolveMostamariPayTable(peerTrId);

  const onlyA = await pool
    .request()
    .input("a", sql.Int, trId)
    .input("b", sql.Int, peerTrId)
    .query(`
      SELECT TOP (${top})
        p.Id, p.PersonId, p.Money, p.FamilyCount, p.TransactionId, Person.NID
      FROM ${tableA} AS p WITH (NOLOCK)
      INNER JOIN dbo.Person WITH (NOLOCK) ON p.PersonId = Person.ID
      WHERE p.TransactionId = @a
        AND p.PersonId NOT IN (
          SELECT PersonId FROM ${tableB} WITH (NOLOCK)
          WHERE TransactionId = @b
        )
      ORDER BY p.Id DESC
    `);

  const onlyB = await pool
    .request()
    .input("a", sql.Int, trId)
    .input("b", sql.Int, peerTrId)
    .query(`
      SELECT TOP (${top})
        p.Id, p.PersonId, p.Money, p.FamilyCount, p.TransactionId, Person.NID
      FROM ${tableB} AS p WITH (NOLOCK)
      INNER JOIN dbo.Person WITH (NOLOCK) ON p.PersonId = Person.ID
      WHERE p.TransactionId = @b
        AND p.PersonId NOT IN (
          SELECT PersonId FROM ${tableA} WITH (NOLOCK)
          WHERE TransactionId = @a
        )
      ORDER BY p.Id DESC
    `);

  const moneyMismatch = await pool
    .request()
    .input("a", sql.Int, trId)
    .input("b", sql.Int, peerTrId)
    .query(`
      SELECT TOP (${top})
        pa.PersonId, Person.NID, pa.Money AS MoneyA, pb.Money AS MoneyB,
        pa.Id AS IdA, pb.Id AS IdB
      FROM ${tableA} AS pa WITH (NOLOCK)
      INNER JOIN ${tableB} AS pb WITH (NOLOCK)
        ON pa.PersonId = pb.PersonId
      INNER JOIN dbo.Person WITH (NOLOCK) ON pa.PersonId = Person.ID
      WHERE pa.TransactionId = @a AND pb.TransactionId = @b
        AND pa.Money <> pb.Money
      ORDER BY Person.NID
    `);

  const onlyARows = onlyA.recordset as Record<string, unknown>[];
  const onlyBRows = onlyB.recordset as Record<string, unknown>[];
  const mismatchRows = moneyMismatch.recordset as Record<string, unknown>[];

  return {
    ok: true as const,
    trId,
    peerTrId,
    onlyInTrId: onlyARows,
    onlyInPeer: onlyBRows,
    moneyMismatch: mismatchRows,
    summary: {
      onlyInTrIdSample: onlyARows.length,
      onlyInPeerSample: onlyBRows.length,
      moneyMismatchSample: mismatchRows.length,
    },
    message:
      onlyARows.length || onlyBRows.length || mismatchRows.length
        ? `Diffs found (samples) — A∖B=${onlyARows.length}, B∖A=${onlyBRows.length}, money≠=${mismatchRows.length}. Bulk DELETE is manual/lab after hours.`
        : "No sample diffs in TOP N — lists look aligned (verify full counts offline).",
    deleteNote:
      "Ops DELETE templates stay outside the wizard. Align after business hours to reduce race with live register/approve.",
  };
}

/**
 * Sample rows missing Sheba (bank disk prep).
 * Fast path: equality join on AccountNumber (uses IX) + NOT EXISTS — no LTRIM on both sides.
 */
export async function mostamariMissingIbn(trId: number, limit = 40) {
  if (!Number.isFinite(trId) || trId <= 0) throw new Error("TransactionId invalid");
  const top = Math.min(100, Math.max(5, limit));
  const pool = await getReadPool();
  const payTable = await resolveMostamariPayTable(trId);
  const req = pool.request();
  req.timeout = 45_000;
  req.input("id", sql.Int, trId);
  const rs = await req.query(`
    SELECT TOP (${top})
      p.Id, p.PersonId, p.AccountNumber, p.Money, Person.NID,
      Person.FirstName, Person.LastName, Center.CenterTitle, Province.ProvinceTitle
    FROM ${payTable} AS p WITH (NOLOCK)
    INNER JOIN dbo.Person WITH (NOLOCK) ON p.PersonId = Person.ID
    INNER JOIN dbo.Center WITH (NOLOCK) ON p.CenterRegistrarId = Center.CenterId
    INNER JOIN dbo.City WITH (NOLOCK) ON Center.CityID = City.CityId
    INNER JOIN dbo.Province WITH (NOLOCK) ON City.ProvinceId = Province.ProvinceId
    WHERE p.TransactionId = @id
      AND NOT EXISTS (
        SELECT 1
        FROM dbo.IBN_AccountNumber AS i WITH (NOLOCK)
        WHERE i.AccountNumber = p.AccountNumber
          AND i.IBN IS NOT NULL
          AND i.IBN <> N''
          AND i.IBN <> N'null'
      )
    ORDER BY p.Id DESC
  `);
  const rows = rs.recordset as Record<string, unknown>[];
  return {
    ok: true as const,
    trId,
    rows,
    totalSample: rows.length,
    columns: rows[0] ? Object.keys(rows[0]) : [],
    message:
      rows.length > 0
        ? `${rows.length.toLocaleString("fa-IR")} ردیف فاقد شبا در نمونه`
        : "در این نمونه فاقد شبا نیست",
    chunkNote: null,
  };
}

/**
 * Build Armaghan bank diskette for مستمری (same as dbo.Export):
 * 1) write fixed-width file to Diskette UNC + SET FileName
 * 2) fallback EXEC dbo.Export @name, @transactionId
 */
export async function labExportMostamariBank(trId: number, fileName?: string) {
  requireLab();
  if (!Number.isFinite(trId) || trId <= 0) throw new Error("TransactionId نامعتبر");
  const name =
    (fileName && fileName.trim()) ||
    mostamariBankFilename(trId) ||
    defaultLabBankFile(trId);
  const started = Date.now();
  const errors: string[] = [];

  try {
    const written = await writeMostamariArmaghanBankFile(trId, name);
    const pool = await getWritePool();
    const req = pool.request();
    req.input("id", sql.Int, trId);
    req.input("name", sql.NVarChar(100), name.slice(0, 100));
    await req.query(`
      UPDATE dbo.PayedTransaction
      SET FileName = @name
      WHERE Id = @id
    `);
    return {
      ok: true as const,
      action: "bank_export" as const,
      trId,
      fileName: name,
      uncPath: written.uncPath,
      bytes: written.bytes,
      via: "unc" as const,
      ms: Date.now() - started,
      message: `دیسکت بانک ارمغان نوشته شد — FileName=${name}`,
    };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  try {
    assertSqlProc("Export");
    await labExecProc("Export", { trId });
    // labExecProc uses defaultLabBankFile — read FileName back
    const after = await getMostamariTransaction(trId, { countRows: false });
    const fn = after.header.FileName || defaultLabBankFile(trId);
    return {
      ok: true as const,
      action: "bank_export" as const,
      trId,
      fileName: fn,
      uncPath: null as string | null,
      bytes: null as number | null,
      via: "sp" as const,
      ms: Date.now() - started,
      message: `دیسکت بانک با dbo.Export ساخته شد — FileName=${fn}`,
      warnings: errors,
    };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  throw new Error(
    `ساخت دیسکت بانک ناموفق:\n۱) UNC: ${errors[0] || "—"}\n۲) dbo.Export: ${errors[1] || "—"}`,
  );
}

/**
 * Approve / confirm paid mostamari (ops doc):
 * SET Ky, Year (YYYYMM), AcceptorUserId, AcceptanceDateTime
 * Cancelled: only Ky=CANCELLED.
 */
export async function labApproveMostamari(opts: {
  trId: number;
  typeId: MostamariTypeId | "cancelled";
  yearMonth: string; // YYYYMM e.g. 140401
  username?: string | null;
  cancelled?: boolean;
}) {
  requireLab();
  const trId = opts.trId;
  if (!Number.isFinite(trId) || trId <= 0) throw new Error("TransactionId نامعتبر");

  const cancelled = !!opts.cancelled || opts.typeId === "cancelled";
  const type = cancelled ? null : getMostamariType(opts.typeId as MostamariTypeId);
  if (!cancelled && !type) throw new Error("نوع مستمری نامعتبر");

  const yearMonth = String(opts.yearMonth || "").trim();
  if (!cancelled && !/^\d{6}$/.test(yearMonth)) {
    throw new Error("سال/ماه باید به صورت YYYYMM باشد (مثال ۱۴۰۴۰۱ → 140401)");
  }

  let existingBankFile: string | null = null;
  let promoted = false;
  const started = Date.now();
  if (!cancelled) {
    const gate = await getMostamariTransaction(trId, { countRows: false });
    if (gate.header.payedRows <= 0) {
      throw new Error("Cannot approve — no pay rows (draft or live) for this TrId");
    }
    existingBankFile = gate.header.FileName || null;
    // Promote only when draft exists and live is still empty (first approve).
    // If live already has rows, skip DELETE+INSERT (~1.5M) — just set Ky below.
    // SyncIt=0: IT sync is the other big cost; bank diskette stays on bankPrep.
    if (isCalcDraftEnabled() && (await mostamariDraftHasRows(trId))) {
      const liveAlready = await mostamariLiveHasRows(trId);
      if (!liveAlready) {
        await labExecProc("PromoteMostamariDraft", {
          trId,
          syncIt: false,
        });
        promoted = true;
      }
    }
  } else if (isCalcDraftEnabled()) {
    try {
      await labExecProc("ClearMostamariDraft", { trId });
    } catch {
      /* draft table may be empty */
    }
  }

  const pool = await getWritePool();
  const req = pool.request();
  req.input("id", sql.Int, trId);

  if (cancelled) {
    req.input("ky", sql.NVarChar, "CANCELLED");
    await req.query(`
      UPDATE dbo.PayedTransaction
      SET Ky = @ky,
          Year = NULL,
          AcceptorUserId = NULL,
          AcceptanceDateTime = NULL
      WHERE Id = @id
    `);
    return {
      ok: true as const,
      action: "cancel" as const,
      trId,
      ky: "CANCELLED",
      ms: Date.now() - started,
      message: `تراکنش #${trId} با Ky=CANCELLED علامت خورد`,
    };
  }

  const registrarId = await resolveRegistrarUserId(opts.username);
  req.input("ky", sql.NVarChar, type!.ky);
  req.input("year", sql.NVarChar, yearMonth);
  req.input("acceptor", sql.Int, registrarId);
  await req.query(`
    UPDATE dbo.PayedTransaction
    SET Ky = @ky,
        Year = @year,
        AcceptorUserId = ISNULL(@acceptor, UserRegistrarId),
        AcceptanceDateTime = ISNULL(RegistrationDate, GETDATE())
    WHERE Id = @id
  `);

  // Never rebuild bank diskette here — use bankPrep step (or existing FileName).
  const bankFileName: string | null = existingBankFile;
  const bankWarning: string | null = existingBankFile
    ? null
    : "دیسکت بانک در تایید ساخته نشد — از مرحله «تهیه دیسکت بانک» استفاده کنید.";

  return {
    ok: true as const,
    action: "approve" as const,
    trId,
    ky: type!.ky,
    yearMonth,
    fileName: bankFileName,
    bankVia: bankFileName ? ("reuse" as const) : null,
    promoted,
    ms: Date.now() - started,
    message: bankFileName
      ? `تایید شد — Ky=${type!.ky} · Year=${yearMonth} · دیسکت=${bankFileName}${promoted ? " · ارتقا پیش‌نویس" : ""}`
      : `تایید شد — Ky=${type!.ky} · Year=${yearMonth}${promoted ? " · ارتقا پیش‌نویس" : ""}`,
    bankWarning,
  };
}
