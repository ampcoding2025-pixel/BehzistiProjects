import { getReadPool, sql } from "@/lib/db/pool";
import { inferMostamariType } from "@/lib/mostamari/types";

export type MostamariCompareDiff = {
  field: string;
  labelFa: string;
  ours: string;
  ops: string;
  match: boolean;
};

function filled(v: unknown) {
  const s = v == null ? "" : String(v).trim();
  return s !== "" && s !== "0" && s.toLowerCase() !== "null";
}

function fmtNum(n: number | null | undefined) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return Number(n).toLocaleString("en-US");
}

function moneyKey(
  rows: Array<{ cnt?: unknown; Money?: unknown }>,
): string {
  return rows
    .map((r) => `${Number(r.Money)}:${Number(r.cnt)}`)
    .join("|");
}

/**
 * Read-only: compare panel mostamari queries («ours») with ops-doc scripts («ops»).
 * No Calculate* / no writes.
 */
export async function compareMostamariCalculation(trId: number) {
  if (!Number.isFinite(trId) || trId <= 0) {
    throw new Error("شناسه تراکنش نامعتبر");
  }

  const pool = await getReadPool();

  const hdrRs = await pool
    .request()
    .input("id", sql.Int, trId)
    .query(`
      SELECT Id, Title, RegistrationDate, RelatedTo, Ky, Year,
             AcceptorUserId, AcceptanceDateTime, Description,
             ListToken, FileName, ExportToken
      FROM dbo.PayedTransaction WITH (NOLOCK)
      WHERE Id = @id
    `);
  const header = hdrRs.recordset[0] as Record<string, unknown> | undefined;
  if (!header) throw new Error("تراکنش یافت نشد");

  const title = header.Title != null ? String(header.Title) : null;
  const description =
    header.Description != null ? String(header.Description) : null;
  const ky = header.Ky != null ? String(header.Ky) : null;
  const inferred = inferMostamariType({ ky, title, description });

  // --- ours (panel: COUNT_BIG + money hist + sample ids) ---
  const oursCountRs = await pool
    .request()
    .input("id", sql.Int, trId)
    .query(`
      SELECT COUNT_BIG(*) AS payedRows
      FROM dbo.PayedContinusPayment WITH (NOLOCK)
      WHERE TransactionId = @id
    `);
  const oursPayed = Number(oursCountRs.recordset[0]?.payedRows || 0);

  const oursMoneyRs = await pool
    .request()
    .input("id", sql.Int, trId)
    .query(`
      SELECT COUNT_BIG(*) AS cnt, Money
      FROM dbo.PayedContinusPayment WITH (NOLOCK)
      WHERE TransactionId = @id
      GROUP BY Money
      ORDER BY Money DESC
    `);
  const oursMoney = (oursMoneyRs.recordset || []) as Array<{
    cnt: unknown;
    Money: unknown;
  }>;

  const oursSampleRs = await pool
    .request()
    .input("id", sql.Int, trId)
    .query(`
      SELECT TOP 10 p.Id
      FROM dbo.PayedContinusPayment p WITH (NOLOCK)
      WHERE p.TransactionId = @id
      ORDER BY p.Id DESC
    `);
  const oursSampleIds = (oursSampleRs.recordset || []).map((r) =>
    Number(r.Id),
  );

  // Panel list join (page_ids style) — TOP 10 ids after Person/Center join
  const oursListRs = await pool
    .request()
    .input("id", sql.Int, trId)
    .query(`
      ;WITH page_ids AS (
        SELECT TOP 10 p.Id
        FROM dbo.PayedContinusPayment AS p WITH (NOLOCK)
        WHERE p.TransactionId = @id
        ORDER BY p.Id DESC
      )
      SELECT p.Id
      FROM page_ids pid
      INNER JOIN dbo.PayedContinusPayment AS p WITH (NOLOCK) ON p.Id = pid.Id
      INNER JOIN dbo.Person WITH (NOLOCK) ON p.PersonId = Person.ID
      INNER JOIN dbo.Center WITH (NOLOCK) ON p.CenterRegistrarId = Center.CenterId
      ORDER BY p.Id DESC
    `);
  const oursListIds = (oursListRs.recordset || []).map((r) => Number(r.Id));

  // --- ops (doc: COUNT(*) + mst-money-hist + nurse list join with LTRIM) ---
  const opsCountRs = await pool
    .request()
    .input("TrId", sql.Int, trId)
    .query(`
      SELECT COUNT(*) AS payedRows
      FROM dbo.PayedContinusPayment WITH (NOLOCK)
      WHERE TransactionId = @TrId
    `);
  const opsPayed = Number(opsCountRs.recordset[0]?.payedRows || 0);

  const opsMoneyRs = await pool
    .request()
    .input("TrId", sql.Int, trId)
    .query(`
      SELECT COUNT(*) AS cnt, Money
      FROM dbo.PayedContinusPayment WITH (NOLOCK)
      WHERE TransactionId = @TrId
      GROUP BY Money
      ORDER BY Money DESC
    `);
  const opsMoney = (opsMoneyRs.recordset || []) as Array<{
    cnt: unknown;
    Money: unknown;
  }>;

  let opsListIds: number[] = [];
  let opsListError: string | null = null;
  try {
    const opsListRs = await pool
      .request()
      .input("TrId", sql.Int, trId)
      .query(`
        SELECT TOP 10 p.Id
        FROM dbo.PayedContinusPayment AS p WITH (NOLOCK)
        INNER JOIN dbo.Person WITH (NOLOCK) ON p.PersonId = Person.ID
        INNER JOIN dbo.Center WITH (NOLOCK) ON p.CenterRegistrarId = Center.CenterId
        INNER JOIN dbo.City WITH (NOLOCK) ON Center.CityID = City.CityId
        INNER JOIN dbo.Province WITH (NOLOCK) ON City.ProvinceId = Province.ProvinceId
        LEFT OUTER JOIN dbo.IBN_AccountNumber AS i WITH (NOLOCK)
          ON LTRIM(RTRIM(p.AccountNumber)) = LTRIM(RTRIM(i.AccountNumber))
        WHERE p.TransactionId = @TrId
        ORDER BY p.Id DESC
      `);
    opsListIds = (opsListRs.recordset || []).map((r) => Number(r.Id));
  } catch (err) {
    opsListError = err instanceof Error ? err.message : String(err);
  }

  const hasList = filled(header.ListToken);
  const hasBank =
    filled(header.FileName) || filled(header.ExportToken);
  const hasKy = filled(ky);
  const hasYear = filled(header.Year);
  const accepted = !!(
    header.AcceptorUserId ||
    header.AcceptanceDateTime ||
    hasYear
  );

  let gate: string;
  if (oursPayed <= 0) gate = "NO_CALC — هنوز محاسبه نشده";
  else if (!hasKy || !hasYear) gate = "CALC_OK — تایید Ky/Year مانده";
  else if (!hasList) gate = "APPROVED — لیست/توکن افراد خالی";
  else if (!hasBank) gate = "LIST_OK — دیسکت بانک هنوز خالی";
  else gate = "OK — محاسبه + تایید + لیست/دیسکت";

  const diffs: MostamariCompareDiff[] = [];
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
    fmtNum(oursPayed),
    fmtNum(opsPayed),
    oursPayed === opsPayed,
  );
  push(
    "moneyHist",
    "توزیع مبلغ (histogram)",
    moneyKey(oursMoney) || "—",
    moneyKey(opsMoney) || "—",
    moneyKey(oursMoney) === moneyKey(opsMoney),
  );
  push(
    "sampleIds",
    "۱۰ شناسه آخر پرداخت",
    oursSampleIds.join(",") || "—",
    opsListError
      ? `ERROR: ${opsListError}`
      : opsListIds.join(",") || "—",
    !opsListError &&
      oursSampleIds.join(",") === opsListIds.join(","),
  );
  push(
    "listJoinIds",
    "۱۰ شناسه لیست (join پنل)",
    oursListIds.join(",") || "—",
    opsListError
      ? `ERROR: ${opsListError}`
      : opsListIds.join(",") || "—",
    !opsListError && oursListIds.join(",") === opsListIds.join(","),
  );
  push(
    "ky",
    "Ky",
    hasKy ? String(ky) : "—",
    hasKy ? String(ky) : "—",
    true,
  );
  push(
    "year",
    "Year",
    hasYear ? String(header.Year) : "—",
    hasYear ? String(header.Year) : "—",
    true,
  );
  push(
    "listToken",
    "لیست افراد (ListToken)",
    hasList ? "دارد" : "ندارد",
    hasList ? "دارد" : "ندارد",
    true,
  );
  push(
    "bank",
    "دیسکت بانک (FileName/Export)",
    hasBank ? "دارد" : "ندارد",
    hasBank ? "دارد" : "ندارد",
    true,
  );

  const mismatchCount = diffs.filter((d) => !d.match).length;

  return {
    ok: true as const,
    trId,
    title,
    readonly: true as const,
    noteFa:
      "فقط خواندن — محاسبه/تایید انجام نمی‌شود. «ما» = کوئری پنل؛ «سند» = COUNT/histogram/لیست سند عملیات مستمری.",
    done: {
      calculated: oursPayed > 0,
      payedRows: oursPayed,
      approved: accepted,
      peopleList: hasList,
      bankDisk: hasBank,
      ky: ky,
      year: header.Year != null ? String(header.Year) : null,
      typeId: inferred?.id || null,
      typeTitleFa: inferred?.titleFa || null,
      gate,
    },
    ours: {
      labelFa: "پنل (ما)",
      payedRows: oursPayed,
      moneyBuckets: oursMoney.length,
      sampleIds: oursSampleIds,
    },
    ops: {
      labelFa: "سند عملیات",
      payedRows: opsPayed,
      moneyBuckets: opsMoney.length,
      sampleIds: opsListIds,
    },
    diffs,
    mismatchCount,
    allMatch: mismatchCount === 0,
    messageFa:
      mismatchCount === 0
        ? "نتیجه پنل با سند عملیات برای این تراکنش هم‌خوان است."
        : `${mismatchCount.toLocaleString("fa-IR")} اختلاف بین پنل و سند عملیات.`,
  };
}
