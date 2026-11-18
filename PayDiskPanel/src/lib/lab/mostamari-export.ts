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

const COLS = [
  "Id",
  "PersonId",
  "NID",
  "FirstName",
  "LastName",
  "AccountNumber",
  "ibn",
  "Money",
  "FamilyCount",
  "SupplyLocationId",
  "CenterTitle",
  "CityTitle",
  "ProvinceTitle",
] as const;

const COL_TITLES_FA: Record<(typeof COLS)[number], string> = {
  Id: "شناسه",
  PersonId: "شناسه فرد",
  NID: "کدملی",
  FirstName: "نام",
  LastName: "نام‌خانوادگی",
  AccountNumber: "شماره حساب",
  ibn: "شبا",
  Money: "مبلغ",
  FamilyCount: "بعد خانوار",
  SupplyLocationId: "محل تأمین",
  CenterTitle: "مرکز",
  CityTitle: "شهر",
  ProvinceTitle: "استان",
};

function csvEscape(v: unknown, format: MostamariExportFormat, col: string): string {
  let s = v == null ? "" : String(v);
  // Preserve leading zeros on NID for Excel
  if (col === "NID" && s && (format === "csv-excel" || format === "csv")) {
    s = `="${s.replace(/"/g, '""')}"`;
    return s;
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
  return COLS.map((c) => {
    const t = COL_TITLES_FA[c];
    return format === "tsv" ? t : csvEscape(t, format, c);
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
 * `ibnScope`: all | with-ibn | without-ibn
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
          ON i.AccountNumber = p.AccountNumber
        WHERE p.TransactionId = @id
          ${scopePred}
        ORDER BY p.Id DESC
        OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
      )
      SELECT
        p.Id,
        p.PersonId,
        Person.NID,
        Person.FirstName,
        Person.LastName,
        p.AccountNumber,
        LTRIM(RTRIM(i.IBN)) AS ibn,
        p.Money,
        p.FamilyCount,
        p.SupplyLocationId,
        Center.CenterTitle,
        City.CityTitle,
        Province.ProvinceTitle
      FROM page_ids pid
      INNER JOIN dbo.PayedContinusPayment AS p WITH (NOLOCK) ON p.Id = pid.Id
      INNER JOIN dbo.Person WITH (NOLOCK) ON p.PersonId = Person.ID
      INNER JOIN dbo.Center WITH (NOLOCK) ON p.CenterRegistrarId = Center.CenterId
      INNER JOIN dbo.City WITH (NOLOCK) ON Center.CityID = City.CityId
      INNER JOIN dbo.Province WITH (NOLOCK) ON City.ProvinceId = Province.ProvinceId
      LEFT JOIN dbo.IBN_AccountNumber AS i WITH (NOLOCK)
        ON i.AccountNumber = p.AccountNumber
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
