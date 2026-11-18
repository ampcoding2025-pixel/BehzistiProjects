import { getReadPool, sql } from "@/lib/db/pool";

export type YaraneCompareSide = {
  labelFa: string;
  payedRows: number;
  supplyCount: number;
  subsidySum: number | null;
  hasPeopleList: boolean;
  hasBank: boolean;
  gate: string | null;
  supplies: Array<{
    id: number;
    title: string;
    keyword?: string;
    cnt: number;
  }>;
  sampleIds: number[];
};

export type YaraneCompareDiff = {
  field: string;
  labelFa: string;
  ours: string;
  ops: string;
  match: boolean;
};

function filled(v: unknown) {
  const s = v == null ? "" : String(v).trim();
  return s !== "" && s !== "0";
}

function fmtNum(n: number | null | undefined) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return Number(n).toLocaleString("en-US");
}

/**
 * Read-only: compare panel aggregates («ours») with ops-doc scripts («ops»)
 * for an existing MakeOver transaction — no Calculate* / no writes.
 */
export async function compareYaraneCalculation(trId: number) {
  if (!Number.isFinite(trId) || trId <= 0) {
    throw new Error("شناسه تراکنش نامعتبر");
  }

  const pool = await getReadPool();

  const hdrReq = pool.request();
  hdrReq.input("id", sql.Int, trId);
  const hdrRs = await hdrReq.query(`
    SELECT Id, Title, Date, Registrar, Key1, Key2, Key3
    FROM dbo.MakeOverTransactions WITH (NOLOCK)
    WHERE Id = @id
  `);
  const header = hdrRs.recordset[0] as Record<string, unknown> | undefined;
  if (!header) throw new Error("تراکنش یافت نشد");

  // --- ours (panel): Local + Universe only — NewUniversalSubsidy mirrors Universe on calc rows ---
  const oursAggReq = pool.request();
  oursAggReq.timeout = 180_000;
  oursAggReq.input("id", sql.Int, trId);
  const oursAggRs = await oursAggReq.query(`
    SELECT
      COUNT_BIG(*) AS payedRows,
      COUNT(DISTINCT MakeOverSupplyLocationId) AS supplyCount,
      SUM(ISNULL(LocalSubsidy,0) + ISNULL(UniverseSubsidy,0)) AS subsidySum
    FROM dbo.PayedMakeOvers WITH (NOLOCK)
    WHERE TransactionId = @id
  `);
  const oursAgg = (oursAggRs.recordset[0] || {}) as Record<string, unknown>;


  const oursSupReq = pool.request();
  oursSupReq.timeout = 120_000;
  oursSupReq.input("id", sql.Int, trId);
  const oursSupRs = await oursSupReq.query(`
    SELECT TOP 20
      p.MakeOverSupplyLocationId AS Id,
      ISNULL(s.MakeOverSupplyLocationTitle, N'(نامشخص)') AS Title,
      ISNULL(s.MakeOverSuplyLocationKeyword, N'') AS Keyword,
      COUNT_BIG(*) AS cnt
    FROM dbo.PayedMakeOvers p WITH (NOLOCK)
    LEFT JOIN dbo.MakeOverSupplyLocation s WITH (NOLOCK)
      ON s.MakeOverSupplyLocationId = p.MakeOverSupplyLocationId
    WHERE p.TransactionId = @id
    GROUP BY p.MakeOverSupplyLocationId, s.MakeOverSupplyLocationTitle, s.MakeOverSuplyLocationKeyword
    ORDER BY COUNT_BIG(*) DESC
  `);

  const oursSampleReq = pool.request();
  oursSampleReq.timeout = 60_000;
  oursSampleReq.input("id", sql.Int, trId);
  const oursSampleRs = await oursSampleReq.query(`
    SELECT TOP 10 p.Id
    FROM dbo.PayedMakeOvers p WITH (NOLOCK)
    WHERE p.TransactionId = @id
    ORDER BY p.Id DESC
  `);

  // --- ops (doc scripts: yrn-count-payed / yrn-supply / yrn-gate / person TOP ids) ---
  // Ops money = Local + Universe (official / past calc; do not add NewUniversalSubsidy).
  const opsAggReq = pool.request();
  opsAggReq.timeout = 180_000;
  opsAggReq.input("TrId", sql.Int, trId);
  const opsAggRs = await opsAggReq.query(`
    SELECT
      COUNT(*) AS payedRows,
      COUNT(DISTINCT MakeOverSupplyLocationId) AS supplyCount,
      SUM(ISNULL(LocalSubsidy,0) + ISNULL(UniverseSubsidy,0)) AS subsidySum
    FROM dbo.PayedMakeOvers WITH (NOLOCK)
    WHERE TransactionId = @TrId
  `);
  const opsAgg = opsAggRs.recordset[0] || {};

  const opsSupReq = pool.request();
  opsSupReq.timeout = 120_000;
  opsSupReq.input("TrId", sql.Int, trId);
  const opsSupRs = await opsSupReq.query(`
    SELECT TOP 20
      p.MakeOverSupplyLocationId AS SupplyLocationId,
      ISNULL(s.MakeOverSupplyLocationTitle, N'(نامشخص)') AS Title,
      ISNULL(s.MakeOverSuplyLocationKeyword, N'') AS Keyword,
      COUNT(*) AS cnt
    FROM dbo.PayedMakeOvers p WITH (NOLOCK)
    LEFT JOIN dbo.MakeOverSupplyLocation s WITH (NOLOCK)
      ON s.MakeOverSupplyLocationId = p.MakeOverSupplyLocationId
    WHERE p.TransactionId = @TrId
    GROUP BY p.MakeOverSupplyLocationId, s.MakeOverSupplyLocationTitle, s.MakeOverSuplyLocationKeyword
    ORDER BY COUNT(*) DESC
  `);

  const opsGateReq = pool.request();
  opsGateReq.timeout = 180_000;
  opsGateReq.input("TrId", sql.Int, trId);
  const opsGateRs = await opsGateReq.query(`
    SELECT
      t.Id, t.Title, t.Key2, t.Key3,
      ISNULL(p.cnt, 0) AS payedRows,
      CASE
        WHEN ISNULL(p.cnt,0) > 0 AND (t.Key2 IS NULL OR LTRIM(RTRIM(t.Key2))='')
          THEN N'BLOCK_FINANCE — محاسبه بدون لیست'
        WHEN ISNULL(p.cnt,0) > 0 AND t.Key2 IS NOT NULL AND LTRIM(RTRIM(t.Key2))<>''
          THEN N'OK — لیست افراد ثبت شده'
        WHEN ISNULL(p.cnt,0) = 0
          THEN N'NO_CALC — هنوز محاسبه نشده'
        ELSE N'CHECK'
      END AS gate
    FROM dbo.MakeOverTransactions t WITH (NOLOCK)
    LEFT JOIN (
      SELECT TransactionId, COUNT(*) AS cnt
      FROM dbo.PayedMakeOvers WITH (NOLOCK)
      WHERE TransactionId = @TrId
      GROUP BY TransactionId
    ) p ON p.TransactionId = t.Id
    WHERE t.Id = @TrId
  `);
  const gateRow = opsGateRs.recordset[0] || {};

  // Ops person-list join (doc) — only TOP ids for set compare
  const opsSampleReq = pool.request();
  opsSampleReq.timeout = 120_000;
  opsSampleReq.input("TrId", sql.Int, trId);
  let opsSampleIds: number[] = [];
  let opsSampleError: string | null = null;
  try {
    const opsSampleRs = await opsSampleReq.query(`
      SELECT TOP 10 PayedMakeOvers.Id
      FROM dbo.Province WITH (NOLOCK)
      INNER JOIN dbo.City WITH (NOLOCK) ON Province.ProvinceId = City.ProvinceId
      INNER JOIN dbo.PayedMakeOvers WITH (NOLOCK)
        INNER JOIN dbo.Person WITH (NOLOCK) ON PayedMakeOvers.PersonId = Person.ID
        INNER JOIN dbo.Center WITH (NOLOCK) ON PayedMakeOvers.CenterId = Center.CenterId
        ON City.CityId = Center.CityID
      INNER JOIN dbo.MakeOverTransactions WITH (NOLOCK)
        ON PayedMakeOvers.TransactionId = MakeOverTransactions.Id
      WHERE PayedMakeOvers.TransactionId = @TrId
      ORDER BY PayedMakeOvers.Id DESC
    `);
    opsSampleIds = (opsSampleRs.recordset || []).map((r) => Number(r.Id));
  } catch (err) {
    opsSampleError = err instanceof Error ? err.message : String(err);
  }

  const ours: YaraneCompareSide = {
    labelFa: "پنل (ما)",
    payedRows: Number(oursAgg.payedRows || 0),
    supplyCount: Number(oursAgg.supplyCount || 0),
    subsidySum: Number(oursAgg.subsidySum || 0),
    hasPeopleList: filled(header.Key2),
    hasBank: filled(header.Key3),
    gate: null,
    supplies: (oursSupRs.recordset || []).map((r) => ({
      id: Number(r.Id),
      title: String(r.Title || ""),
      keyword: String(r.Keyword || ""),
      cnt: Number(r.cnt || 0),
    })),
    sampleIds: (oursSampleRs.recordset || []).map((r) => Number(r.Id)),
  };

  const ops: YaraneCompareSide = {
    labelFa: "سند عملیات",
    payedRows: Number(opsAgg.payedRows || 0),
    supplyCount: Number(opsAgg.supplyCount || 0),
    subsidySum: Number(opsAgg.subsidySum || 0),
    hasPeopleList: filled(header.Key2),
    hasBank: filled(header.Key3),
    gate: gateRow.gate != null ? String(gateRow.gate) : null,
    supplies: (opsSupRs.recordset || []).map((r) => ({
      id: Number(r.SupplyLocationId),
      title: String(r.Title || ""),
      keyword: String(r.Keyword || ""),
      cnt: Number(r.cnt || 0),
    })),
    sampleIds: opsSampleIds,
  };

  const diffs: YaraneCompareDiff[] = [];
  const push = (
    field: string,
    labelFa: string,
    a: string,
    b: string,
    match: boolean,
  ) => diffs.push({ field, labelFa, ours: a, ops: b, match });

  push(
    "payedRows",
    "تعداد ردیف محاسبه",
    fmtNum(ours.payedRows),
    fmtNum(ops.payedRows),
    ours.payedRows === ops.payedRows,
  );
  push(
    "supplyCount",
    "تعداد محل تأمین",
    fmtNum(ours.supplyCount),
    fmtNum(ops.supplyCount),
    ours.supplyCount === ops.supplyCount,
  );
  push(
    "subsidySum",
    "جمع یارانه (Local+Universe)",
    fmtNum(ours.subsidySum),
    fmtNum(ops.subsidySum),
    Number(ours.subsidySum) === Number(ops.subsidySum),
  );

  const oursSupKey = ours.supplies
    .map((s) => `${s.id}:${s.cnt}`)
    .join("|");
  const opsSupKey = ops.supplies.map((s) => `${s.id}:${s.cnt}`).join("|");
  push(
    "supplies",
    "تفکیک محل تأمین",
    oursSupKey || "—",
    opsSupKey || "—",
    oursSupKey === opsSupKey,
  );

  const oursIds = ours.sampleIds.join(",");
  const opsIds = ops.sampleIds.join(",");
  push(
    "sampleIds",
    "۱۰ شناسه آخر نمونه لیست",
    oursIds || "—",
    opsSampleError ? `ERROR: ${opsSampleError}` : opsIds || "—",
    !opsSampleError && oursIds === opsIds,
  );

  push(
    "key2",
    "لیست افراد (Key2)",
    ours.hasPeopleList ? "دارد" : "ندارد",
    ops.hasPeopleList ? "دارد" : "ندارد",
    ours.hasPeopleList === ops.hasPeopleList,
  );
  push(
    "key3",
    "دیسکت بانک (Key3)",
    ours.hasBank ? "دارد" : "ندارد",
    ops.hasBank ? "دارد" : "ندارد",
    ours.hasBank === ops.hasBank,
  );

  const mismatchCount = diffs.filter((d) => !d.match).length;
  const done = {
    calculated: ours.payedRows > 0,
    peopleList: ours.hasPeopleList,
    bankDisk: ours.hasBank,
    gate: ops.gate,
  };

  return {
    ok: true as const,
    trId,
    title: header.Title != null ? String(header.Title) : null,
    readonly: true as const,
    noteFa:
      "فقط خواندن — محاسبه/ثبت انجام نمی‌شود. «ما» = کوئری پنل؛ «سند» = کوئری‌های yrn-* سند عملیات.",
    done,
    ours,
    ops,
    diffs,
    mismatchCount,
    allMatch: mismatchCount === 0,
    messageFa:
      mismatchCount === 0
        ? "نتیجه پنل با سند عملیات برای این تراکنش هم‌خوان است."
        : `${mismatchCount.toLocaleString("fa-IR")} اختلاف بین پنل و سند عملیات.`,
  };
}
