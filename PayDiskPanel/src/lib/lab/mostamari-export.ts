import {
  marhaleForMostamariTrId,
  queryMostamariOpsPayListPage,
} from "@/lib/lab/mostamari-ops-list";
import {
  MOSTAMARI_OPS_LIST_COLS,
  type MostamariOpsListCol,
} from "@/lib/mostamari/ops-list-cols";
import {
  MOSTAMARI_EXPORT_FORMATS,
  MOSTAMARI_EXPORT_IBN_SCOPES,
  type MostamariExportFormat,
  type MostamariExportIbnScope,
} from "@/lib/mostamari/export-formats";

export type { MostamariExportFormat, MostamariExportIbnScope };
export { MOSTAMARI_EXPORT_FORMATS, MOSTAMARI_EXPORT_IBN_SCOPES };

/** @deprecated alias — ops list columns are the export headers now. */
export const MOSTAMARI_ARMAGHAN_LIST_COLS = MOSTAMARI_OPS_LIST_COLS;

const BATCH = 3000;
const COLS = MOSTAMARI_OPS_LIST_COLS;
type Col = MostamariOpsListCol;

const NID_COLS: ReadonlySet<Col> = new Set(["NIDMadadjo", "NIDSahebHesab"]);

function csvEscape(v: unknown, format: MostamariExportFormat, col: Col): string {
  let s = v == null ? "" : String(v);
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    s = v.toISOString().slice(0, 10);
  }
  // Preserve leading zeros on national IDs for Excel
  if (NID_COLS.has(col) && s && (format === "csv-excel" || format === "csv")) {
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

/**
 * Async generator: streams ops-doc pay-list rows (تهیه لیست مستمری بگیران).
 * Headers = exact ops aliases (NIDMadadjo, sheba, Marhale, …).
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
  const marhale = await marhaleForMostamariTrId(trId);

  if (format === "csv" || format === "csv-excel") {
    yield "\uFEFF";
  }
  yield `${headerLine(format)}\r\n`;

  let offset = 0;
  for (;;) {
    const { rows } = await queryMostamariOpsPayListPage({
      trId,
      offset,
      fetchN: BATCH,
      marhale,
      ibnScope: scope,
    });
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
