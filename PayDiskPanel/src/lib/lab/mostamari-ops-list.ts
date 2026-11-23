import { getReadPool, sql } from "@/lib/db/pool";
import { resolveMostamariPayTable } from "@/lib/lab/calc-draft";
import { isoToShamsi, JALALI_MONTHS_FA } from "@/lib/shamsi";

export {
  MOSTAMARI_OPS_LIST_COLS,
  MOSTAMARI_OPS_LIST_COL_FA,
  type MostamariOpsListCol,
} from "@/lib/mostamari/ops-list-cols";

/** Ops Marhale literal style: شهریور1405 */
export function formatMostamariMarhale(isoYmd: string | null | undefined): string {
  if (!isoYmd) return "";
  const parts = isoToShamsi(String(isoYmd).slice(0, 10));
  if (!parts) return "";
  const month = JALALI_MONTHS_FA[parts.jm - 1] || "";
  return `${month}${parts.jy}`;
}

type ListSource = "it" | "dbo";
type IbnSource = "calc" | "ibn";

let cachedListSource: ListSource | null = null;
let cachedIbnSource: IbnSource | null = null;

async function resolveListSource(): Promise<ListSource> {
  if (cachedListSource) return cachedListSource;
  const pool = await getReadPool();
  try {
    const rs = await pool.request().query(`
      SELECT CASE
        WHEN OBJECT_ID(N'IT.dbo.tbl_PayedContinusPayment_ReceiverNID', N'U') IS NOT NULL
        THEN 1 ELSE 0 END AS ok
    `);
    cachedListSource =
      Number((rs.recordset[0] as { ok?: number })?.ok) === 1 ? "it" : "dbo";
  } catch {
    cachedListSource = "dbo";
  }
  return cachedListSource;
}

async function resolveIbnSource(): Promise<IbnSource> {
  if (cachedIbnSource) return cachedIbnSource;
  const pool = await getReadPool();
  try {
    // Calculate table may exist without an IBN column — require COL_LENGTH.
    const rs = await pool.request().query(`
      SELECT CASE
        WHEN OBJECT_ID(N'dbo.IBN_AccountNumber_Calculate', N'U') IS NOT NULL
         AND COL_LENGTH(N'dbo.IBN_AccountNumber_Calculate', N'IBN') IS NOT NULL
        THEN 1 ELSE 0 END AS ok
    `);
    cachedIbnSource =
      Number((rs.recordset[0] as { ok?: number })?.ok) === 1 ? "calc" : "ibn";
  } catch {
    cachedIbnSource = "ibn";
  }
  return cachedIbnSource;
}

function ibnTableSql(ibn: IbnSource) {
  return ibn === "calc"
    ? "dbo.IBN_AccountNumber_Calculate"
    : "dbo.IBN_AccountNumber";
}

function payFromSql(list: ListSource, preferDraft = false) {
  if (preferDraft) return "dbo.PayedContinusPayment_Draft";
  return list === "it"
    ? "IT.dbo.tbl_PayedContinusPayment_ReceiverNID"
    : "dbo.PayedContinusPayment";
}

/** SELECT body with ops aliases. @marhale is bound as nvarchar. */
function opsListSelectSql(list: ListSource): string {
  const receiverNid =
    list === "it"
      ? "l.ReceiverNID"
      : "CAST(Person.NID AS nvarchar(30))";
  return `
    Person.NID AS NIDMadadjo,
    Person.BirthDate AS BirthDate,
    Person.FirstName AS FirstName,
    Person.LastName AS LastName,
    Person.IsIranian AS IsIranian,
    N'رفاه کارگران' AS Bank,
    Province.ProvinceTitle AS ProvinceTitle,
    City.CityTitle AS CityTitle,
    Center.CenterTitle AS CenterTitle,
    l.AccountNumber AS AccountNumber,
    LTRIM(RTRIM(i.IBN)) AS sheba,
    ${receiverNid} AS NIDSahebHesab,
    l.Money AS Money,
    @marhale AS Marhale,
    Person.Cellphone AS mobile,
    l.SupplyLocationId AS madadjotype,
    l.FamilyCount AS khanevar_dim,
    l.PersonId AS PersonId
  `;
}

export type MostamariOpsListIbnScope = "all" | "with-ibn" | "without-ibn";

function ibnScopeSql(scope: MostamariOpsListIbnScope): string {
  if (scope === "with-ibn") {
    return `AND i.IBN IS NOT NULL AND LTRIM(RTRIM(i.IBN)) <> N'' AND i.IBN <> N'null'`;
  }
  if (scope === "without-ibn") {
    return `AND (i.IBN IS NULL OR LTRIM(RTRIM(i.IBN)) = N'' OR i.IBN = N'null')`;
  }
  return "";
}

export async function queryMostamariOpsPayListPage(opts: {
  trId: number;
  offset: number;
  /** Fetch this many (+ optionally caller slices). */
  fetchN: number;
  marhale: string;
  ibnScope?: MostamariOpsListIbnScope;
}): Promise<{
  rows: Record<string, unknown>[];
  listSource: ListSource;
  ibnSource: IbnSource;
}> {
  const payResolved = await resolveMostamariPayTable(opts.trId);
  const preferDraft = payResolved.includes("_Draft");
  // Draft has no IT mirror — always dbo-shaped columns from draft/live Payed.
  const list: ListSource = preferDraft ? "dbo" : await resolveListSource();
  let ibn = await resolveIbnSource();
  const scope = opts.ibnScope || "all";
  const pool = await getReadPool();

  const run = async (ibnSrc: IbnSource) => {
    const scopePred = ibnScopeSql(scope);
    const req = pool.request();
    req.timeout = 120_000;
    req.input("id", sql.Int, opts.trId);
    req.input("offset", sql.Int, opts.offset);
    req.input("fetchN", sql.Int, opts.fetchN);
    req.input("marhale", sql.NVarChar(40), opts.marhale || "");

    const fromPay = payFromSql(list, preferDraft);
    const fromIbn = ibnTableSql(ibnSrc);
    const orderBy =
      list === "it"
        ? "l.PersonId DESC, l.AccountNumber"
        : "l.Id DESC";

    return req.query(`
      ;WITH page_keys AS (
        SELECT
          ${list === "it" ? "l.PersonId, l.AccountNumber" : "l.Id"}
        FROM ${fromPay} AS l WITH (NOLOCK)
        ${
          scope !== "all"
            ? `LEFT JOIN ${fromIbn} AS i WITH (NOLOCK)
                 ON LTRIM(RTRIM(i.AccountNumber)) = LTRIM(RTRIM(l.AccountNumber))`
            : ""
        }
        WHERE l.TransactionId = @id
          ${scopePred}
        ORDER BY ${orderBy}
        OFFSET @offset ROWS FETCH NEXT @fetchN ROWS ONLY
      )
      SELECT
        ${opsListSelectSql(list)}
      FROM page_keys pk
      INNER JOIN ${fromPay} AS l WITH (NOLOCK)
        ON ${
          list === "it"
            ? "l.PersonId = pk.PersonId AND LTRIM(RTRIM(l.AccountNumber)) = LTRIM(RTRIM(pk.AccountNumber)) AND l.TransactionId = @id"
            : "l.Id = pk.Id"
        }
      INNER JOIN dbo.Person WITH (NOLOCK) ON l.PersonId = Person.ID
      INNER JOIN dbo.Center WITH (NOLOCK) ON l.CenterRegistrarId = Center.CenterId
      INNER JOIN dbo.City WITH (NOLOCK) ON Center.CityID = City.CityId
      INNER JOIN dbo.Province WITH (NOLOCK) ON City.ProvinceId = Province.ProvinceId
      LEFT JOIN ${fromIbn} AS i WITH (NOLOCK)
        ON LTRIM(RTRIM(i.AccountNumber)) = LTRIM(RTRIM(l.AccountNumber))
      ORDER BY ${orderBy}
    `);
  };

  let rs;
  try {
    rs = await run(ibn);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Stale cache / wrong Calculate schema → fall back to IBN_AccountNumber
    if (ibn === "calc" && /Invalid column name ['"]IBN['"]/i.test(msg)) {
      cachedIbnSource = "ibn";
      ibn = "ibn";
      rs = await run(ibn);
    } else {
      throw err;
    }
  }

  return {
    rows: rs.recordset as Record<string, unknown>[],
    listSource: list,
    ibnSource: ibn,
  };
}

/** RelatedTo / RegistrationDate → Marhale for a transaction. */
export async function marhaleForMostamariTrId(trId: number): Promise<string> {
  const pool = await getReadPool();
  const req = pool.request();
  req.timeout = 30_000;
  req.input("id", sql.Int, trId);
  const rs = await req.query(`
    SELECT TOP (1) RelatedTo, RegistrationDate
    FROM dbo.PayedTransaction WITH (NOLOCK)
    WHERE Id = @id
  `);
  const row = rs.recordset[0] as
    | { RelatedTo?: unknown; RegistrationDate?: unknown }
    | undefined;
  const raw = row?.RelatedTo ?? row?.RegistrationDate;
  if (raw == null || raw === "") return "";
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, "0");
    const d = String(raw.getDate()).padStart(2, "0");
    return formatMostamariMarhale(`${y}-${m}-${d}`);
  }
  const s = String(raw).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return formatMostamariMarhale(m ? `${m[1]}-${m[2]}-${m[3]}` : s);
}

export async function countMostamariOpsPayList(
  trId: number,
  ibnScope: MostamariOpsListIbnScope = "all",
): Promise<number> {
  const payResolved = await resolveMostamariPayTable(trId);
  const preferDraft = payResolved.includes("_Draft");
  const list: ListSource = preferDraft ? "dbo" : await resolveListSource();
  const ibn = await resolveIbnSource();
  const scopePred = ibnScopeSql(ibnScope);
  const pool = await getReadPool();
  const req = pool.request();
  req.timeout = 120_000;
  req.input("id", sql.Int, trId);
  const needsIbn = ibnScope !== "all";
  const fromPay = payFromSql(list, preferDraft);
  const fromIbn = ibnTableSql(ibn);
  const rs = await req.query(`
    SELECT COUNT_BIG(*) AS total
    FROM ${fromPay} AS l WITH (NOLOCK)
    ${
      needsIbn
        ? `LEFT JOIN ${fromIbn} AS i WITH (NOLOCK)
             ON LTRIM(RTRIM(i.AccountNumber)) = LTRIM(RTRIM(l.AccountNumber))`
        : ""
    }
    WHERE l.TransactionId = @id
      ${needsIbn ? scopePred : ""}
  `);
  return Number(rs.recordset[0]?.total || 0);
}
