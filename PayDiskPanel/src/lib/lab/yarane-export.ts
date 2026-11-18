import { createWriteStream } from "fs";
import { once } from "events";
import path from "path";
import { getReadPool, sql } from "@/lib/db/pool";
import {
  MOSTAMARI_EXPORT_FORMATS,
  MOSTAMARI_EXPORT_IBN_SCOPES,
  type MostamariExportFormat,
  type MostamariExportIbnScope,
} from "@/lib/mostamari/export-formats";

/** Armaghan ListExporMarakez BCP target folder. */
export function yaraneDisketteUncRoot(): string {
  return (
    process.env.PAYDISK_YARANE_DISKETTE_UNC?.trim() ||
    String.raw`\\sqlcluster\MSSQLSERVER\Docs\Documents\Diskette`
  );
}

export type YaraneExportFormat = MostamariExportFormat;
export type YaraneExportIbnScope = MostamariExportIbnScope;

export const YARANE_EXPORT_FORMATS = MOSTAMARI_EXPORT_FORMATS;
export const YARANE_EXPORT_IBN_SCOPES = MOSTAMARI_EXPORT_IBN_SCOPES;

const BATCH = 3000;

/**
 * Same 11 columns as dbo.ListExporMarakez (Armaghan BCP CSV header row).
 * Money = UniverseSubsidy only (not Local+Universe).
 * Used by diskette export and wizard step «لیست افراد».
 */
export const YARANE_ARMAGHAN_LIST_COLS = [
  "FirstName",
  "LastName",
  "NID",
  "Province",
  "City",
  "Center",
  "Account",
  "Money (RLS)",
  "IsPersonal",
  "NationalId",
  "Category",
] as const;

const COLS = YARANE_ARMAGHAN_LIST_COLS;

type Col = (typeof COLS)[number];

/** SELECT list matching ListExporMarakez (aliases = header names). */
export const YARANE_ARMAGHAN_LIST_SELECT = `
  per.FirstName AS FirstName,
  per.LastName AS LastName,
  per.NID AS NID,
  pr.ProvinceTitle AS Province,
  cit.CityTitle AS City,
  cntr.CenterTitle AS Center,
  p.CenterAccount AS Account,
  LTRIM(STR(p.UniverseSubsidy)) AS [Money (RLS)],
  LTRIM(STR(cntr.IsPersonal)) AS IsPersonal,
  cntr.NationalId AS NationalId,
  ssc.CenterSubCatagoryTitle AS Category
`;

function csvEscape(v: unknown, format: YaraneExportFormat, col: Col): string {
  let s = v == null ? "" : String(v);
  // Armaghan wraps values in double-quotes via QUOTENAME(..., char(34))
  if (col === "NID" && s && (format === "csv-excel" || format === "csv")) {
    // Keep digits as text in Excel while still quoting like Armaghan
    const inner = s.replace(/"/g, '""');
    return `"=""${inner}"""`;
  }
  if (format === "tsv") {
    return s.replace(/\t/g, " ").replace(/\r?\n/g, " ");
  }
  return `"${s.replace(/"/g, '""')}"`;
}

function rowLine(row: Record<string, unknown>, format: YaraneExportFormat): string {
  const sep = format === "tsv" ? "\t" : ",";
  return COLS.map((c) => csvEscape(row[c], format, c)).join(sep);
}

function headerLine(format: YaraneExportFormat): string {
  const sep = format === "tsv" ? "\t" : ",";
  // Armaghan writes English header names (FirstName, LastName, …)
  return COLS.map((c) => (format === "tsv" ? c : `"${c}"`)).join(sep);
}

function normalizeIbnScope(scope?: string | null): YaraneExportIbnScope {
  if (scope === "with-ibn" || scope === "without-ibn" || scope === "all") {
    return scope;
  }
  return "all";
}

/** Predicate on Center.IBN (panel filter; Armaghan SP has no IBN filter). */
export function yaraneIbnScopeSql(scope: YaraneExportIbnScope): string {
  if (scope === "with-ibn") {
    return `AND Center.IBN IS NOT NULL AND LTRIM(RTRIM(Center.IBN)) <> N'' AND Center.IBN <> N'null'`;
  }
  if (scope === "without-ibn") {
    return `AND (Center.IBN IS NULL OR LTRIM(RTRIM(Center.IBN)) = N'' OR Center.IBN = N'null')`;
  }
  return "";
}

function ibnScopeSql(scope: YaraneExportIbnScope): string {
  return yaraneIbnScopeSql(scope);
}

/**
 * Stream diskette rows matching Armaghan ListExporMarakez column set.
 * Optional ibnScope only filters rows (with/without/all); columns stay Armaghan.
 */
export async function* iterateYaranePayListExport(
  trId: number,
  format: YaraneExportFormat,
  ibnScope: YaraneExportIbnScope = "all",
): AsyncGenerator<string, void, unknown> {
  if (!Number.isFinite(trId) || trId <= 0) {
    throw new Error("TransactionId نامعتبر");
  }
  const scope = normalizeIbnScope(ibnScope);
  const scopePred = ibnScopeSql(scope);
  const pool = await getReadPool();

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
        FROM dbo.PayedMakeOvers p WITH (NOLOCK)
        INNER JOIN dbo.Center cntr WITH (NOLOCK) ON p.CenterId = cntr.CenterId
        INNER JOIN dbo.CenterSubCatagory ssc WITH (NOLOCK)
          ON ssc.CenterSubCatagoryId = cntr.CenterSubCatagoryId
        WHERE p.TransactionId = @id
          ${scopePred.replace(/Center\./g, "cntr.")}
        ORDER BY p.Id DESC
        OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
      )
      SELECT
        ${YARANE_ARMAGHAN_LIST_SELECT}
      FROM page_ids pid
      INNER JOIN dbo.PayedMakeOvers AS p WITH (NOLOCK) ON p.Id = pid.Id
      INNER JOIN dbo.Person AS per WITH (NOLOCK) ON per.ID = p.PersonId
      INNER JOIN dbo.Center AS cntr WITH (NOLOCK) ON cntr.CenterId = p.CenterId
      INNER JOIN dbo.City AS cit WITH (NOLOCK) ON cit.CityId = cntr.CityID
      INNER JOIN dbo.Province AS pr WITH (NOLOCK) ON pr.ProvinceId = cit.ProvinceId
      INNER JOIN dbo.CenterSubCatagory AS ssc WITH (NOLOCK)
        ON ssc.CenterSubCatagoryId = cntr.CenterSubCatagoryId
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

export function yaraneExportFilename(
  trId: number,
  format: YaraneExportFormat,
  ibnScope: YaraneExportIbnScope = "all",
) {
  const meta = YARANE_EXPORT_FORMATS.find((f) => f.id === format);
  const scopeMeta = YARANE_EXPORT_IBN_SCOPES.find((s) => s.id === ibnScope);
  const ext = meta?.ext || "csv";
  const suffix = scopeMeta?.fileSuffix || "all";
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `yarane-paylist-${trId}-${suffix}-${stamp}.${ext}`;
}

export function yaraneExportMime(format: YaraneExportFormat) {
  return (
    YARANE_EXPORT_FORMATS.find((f) => f.id === format)?.mime ||
    "text/csv; charset=utf-8"
  );
}

export function parseYaraneExportIbnScope(
  raw: string | null | undefined,
): YaraneExportIbnScope {
  return normalizeIbnScope((raw || "").toLowerCase());
}

/**
 * Write Armaghan-format CSV to the Diskette UNC share (same folder as ListExporMarakez BCP).
 * Does not need xp_cmdshell — needs Windows/share write access for the Node process.
 * Uses plain csv (quoted fields like QUOTENAME(...,'"')), no Excel BOM.
 */
export async function writeYaraneArmaghanDisketteFile(
  trId: number,
  fileName: string,
): Promise<{ uncPath: string; bytes: number; ms: number }> {
  if (!Number.isFinite(trId) || trId <= 0) {
    throw new Error("TransactionId نامعتبر");
  }
  const safe = String(fileName || "").trim();
  if (!safe || /[\\/:*?"<>|]/.test(safe) || safe.includes("..")) {
    throw new Error("نام فایل دیسکت نامعتبر است");
  }
  const uncPath = path.win32.join(yaraneDisketteUncRoot(), safe);
  const started = Date.now();
  const stream = createWriteStream(uncPath, { encoding: "utf8", flags: "w" });
  let bytes = 0;

  const write = async (chunk: string) => {
    bytes += Buffer.byteLength(chunk, "utf8");
    if (!stream.write(chunk)) {
      await once(stream, "drain");
    }
  };

  try {
    // No BOM — matches BCP -w output consumed by Armaghan Download
    for await (const chunk of iterateYaranePayListExport(trId, "csv", "all")) {
      if (chunk === "\uFEFF") continue;
      await write(chunk);
    }
    stream.end();
    await once(stream, "finish");
  } catch (err) {
    stream.destroy();
    const raw = err instanceof Error ? err.message : String(err);
    throw new Error(
      `نوشتن فایل روی مسیر ارمغان ناموفق بود (${uncPath}): ${raw}`,
    );
  }

  return { uncPath, bytes, ms: Date.now() - started };
}
