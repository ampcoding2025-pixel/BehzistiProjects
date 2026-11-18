import { getReadPool, sql } from "@/lib/db/pool";
import {
  MOSTAMARI_EXPORT_FORMATS,
  MOSTAMARI_EXPORT_IBN_SCOPES,
  type MostamariExportFormat,
  type MostamariExportIbnScope,
} from "@/lib/mostamari/export-formats";

export type { MostamariExportFormat, MostamariExportIbnScope };
export { MOSTAMARI_EXPORT_FORMATS, MOSTAMARI_EXPORT_IBN_SCOPES };

const BATCH = 3000;

/**
 * Same column set as Armaghan / ops-doc Excel for مستمری pay list
 * (`mst-nurse-emdad-list` in txn-scripts — «خروجی اکسل پرداخت»).
 *
 * Order + English headers match the ops SELECT aliases:
 *   Id, PersonId, AccountNumber, Money, NID, FirstName, LastName,
 *   CenterTitle, CityTitle, ProvinceTitle, ibn
 *
 * Not included (panel UI-only): FamilyCount, SupplyLocationId.
 */
export const MOSTAMARI_ARMAGHAN_LIST_COLS = [
  "Id",
  "PersonId",
  "AccountNumber",
  "Money",
  "NID",
  "FirstName",
  "LastName",
  "CenterTitle",
  "CityTitle",
  "ProvinceTitle",
  "ibn",
] as const;

const COLS = MOSTAMARI_ARMAGHAN_LIST_COLS;
type Col = (typeof COLS)[number];

/** SELECT list matching ops-doc / Armaghan Excel (aliases = header names). */
export const MOSTAMARI_ARMAGHAN_LIST_SELECT = `
  p.Id AS Id,
  p.PersonId AS PersonId,
  p.AccountNumber AS AccountNumber,
  p.Money AS Money,
  Person.NID AS NID,
  Person.FirstName AS FirstName,
  Person.LastName AS LastName,
  Center.CenterTitle AS CenterTitle,
  City.CityTitle AS CityTitle,
  Province.ProvinceTitle AS ProvinceTitle,
  LTRIM(RTRIM(i.IBN)) AS ibn
`;

function csvEscape(v: unknown, format: MostamariExportFormat, col: Col): string {
  let s = v == null ? "" : String(v);
  // Preserve leading zeros on NID for Excel (ops: «NID باید text بماند»)
  if (col === "NID" && s && (format === "csv-excel" || format === "csv")) {
    const inner = s.replace(/"/g, '""');
    return `"=""${inner}"""`;
  }
  if (format === "tsv") {
    return s.replace(/\t/g, " ").replace(/\r?\n/g, " ");
  }
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowLine(
  row: Record<string, unknown>,
  format: MostamariExportFormat,
): string {
  const sep = format === "tsv" ? "\t" : ",";
  return COLS.map((c) => csvEscape(row[c], format, c)).join(sep);
}

function headerLine(format: MostamariExportFormat): string {
  const sep = format === "tsv" ? "\t" : ",";
  // English aliases — same as Armaghan/ops SELECT column names
  return COLS.map((c) => {
    if (format === "tsv") return c;
    return csvEscape(c, format, c);
  }).join(sep);
}

function normalizeIbnScope(scope?: string | null): MostamariExportIbnScope {
  if (scope === "with-ibn" || scope === "without-ibn" || scope === "all") {
    return scope;
  }
  return "all";
}

/** SQL predicate on joined IBN alias `i` (after LEFT JOIN). */
function ibnScopeSql(scope: MostamariExportIbnScope): string {
  if (scope === "with-ibn") {
    return `AND i.IBN IS NOT NULL AND LTRIM(RTRIM(i.IBN)) <> N'' AND i.IBN <> N'null'`;
  }
  if (scope === "without-ibn") {
    return `AND (i.IBN IS NULL OR LTRIM(RTRIM(i.IBN)) = N'' OR i.IBN = N'null')`;
  }
  return "";
}

/**
 * Async generator: streams pay-list rows in batches (no full materialization).
 * Columns match Armaghan ops-doc Excel (`MOSTAMARI_ARMAGHAN_LIST_COLS`).
 */
export async function* iterateMostamariPayListExport(
  trId: number,
  format: MostamariExportFormat,
  ibnScope: MostamariExportIbnScope = "all",
): AsyncGenerator<string, void, unknown> {
  if (!Number.isFinite(trId) || trId <= 0) {
    throw new Error("TransactionId نامعتبر");
  }
  const scope = normalizeIbnScope(ibnScope);
  const scopePred = ibnScopeSql(scope);
  const pool = await getReadPool();

  // UTF-8 BOM so Excel opens Persian correctly
  if (format === "csv" || format === "csv-excel") {
    yield "\uFEFF";
  }
  yield `${headerLine(format)}\r\n`;

  let offset = 0;
  for (;;) {
    const req = pool.request();
    req.timeout = 120_000;
    req.input("id", sql.Int, trId);
    req.input("offset", sql.Int, offset);
    req.input("pageSize", sql.Int, BATCH);
    const rs = await req.query(`
      ;WITH page_ids AS (
        SELECT p.Id
        FROM dbo.PayedContinusPayment AS p WITH (NOLOCK)
        LEFT JOIN dbo.IBN_AccountNumber AS i WITH (NOLOCK)
          ON LTRIM(RTRIM(i.AccountNumber)) = LTRIM(RTRIM(p.AccountNumber))
        WHERE p.TransactionId = @id
          ${scopePred}
        ORDER BY p.Id DESC
        OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
      )
      SELECT
        ${MOSTAMARI_ARMAGHAN_LIST_SELECT}
      FROM page_ids pid
      INNER JOIN dbo.PayedContinusPayment AS p WITH (NOLOCK) ON p.Id = pid.Id
      INNER JOIN dbo.Person WITH (NOLOCK) ON p.PersonId = Person.ID
      INNER JOIN dbo.Center WITH (NOLOCK) ON p.CenterRegistrarId = Center.CenterId
      INNER JOIN dbo.City WITH (NOLOCK) ON Center.CityID = City.CityId
      INNER JOIN dbo.Province WITH (NOLOCK) ON City.ProvinceId = Province.ProvinceId
      LEFT JOIN dbo.IBN_AccountNumber AS i WITH (NOLOCK)
        ON LTRIM(RTRIM(i.AccountNumber)) = LTRIM(RTRIM(p.AccountNumber))
      ORDER BY p.Id DESC
    `);
    const rows = rs.recordset as Record<string, unknown>[];
    if (!rows.length) break;
    let chunk = "";
    for (const row of rows) {
      chunk += `${rowLine(row, format)}\r\n`;
    }
    yield chunk;
    if (rows.length < BATCH) break;
    offset += BATCH;
  }
}

export function mostamariExportFilename(
  trId: number,
  format: MostamariExportFormat,
  ibnScope: MostamariExportIbnScope = "all",
) {
  const meta = MOSTAMARI_EXPORT_FORMATS.find((f) => f.id === format);
  const scopeMeta = MOSTAMARI_EXPORT_IBN_SCOPES.find((s) => s.id === ibnScope);
  const ext = meta?.ext || "csv";
  const suffix = scopeMeta?.fileSuffix || "all";
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `mostamari-paylist-${trId}-${suffix}-${stamp}.${ext}`;
}

export function mostamariExportMime(format: MostamariExportFormat) {
  return (
    MOSTAMARI_EXPORT_FORMATS.find((f) => f.id === format)?.mime ||
    "text/csv; charset=utf-8"
  );
}

export function parseMostamariExportIbnScope(
  raw: string | null | undefined,
): MostamariExportIbnScope {
  return normalizeIbnScope((raw || "").toLowerCase());
}
