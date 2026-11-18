/** Client-safe export format catalog (no DB imports). */

export type MostamariExportFormat = "csv" | "tsv" | "csv-excel";

/** Which pay rows to include in the diskette file. */
export type MostamariExportIbnScope = "all" | "with-ibn" | "without-ibn";

export const MOSTAMARI_EXPORT_IBN_SCOPES: Array<{
  id: MostamariExportIbnScope;
  labelFa: string;
  hintFa: string;
  fileSuffix: string;
}> = [
  {
    id: "with-ibn",
    labelFa: "با شبا",
    hintFa: "فقط ردیف‌هایی که شماره شبا دارند",
    fileSuffix: "with-ibn",
  },
  {
    id: "without-ibn",
    labelFa: "بدون شبا",
    hintFa: "فقط ردیف‌های فاقد شبا (برای قرنطینه/پیگیری)",
    fileSuffix: "without-ibn",
  },
  {
    id: "all",
    labelFa: "همه (با و بدون شبا)",
    hintFa: "کل لیست پرداخت این تراکنش",
    fileSuffix: "all",
  },
];

export const MOSTAMARI_EXPORT_FORMATS: Array<{
  id: MostamariExportFormat;
  labelFa: string;
  ext: string;
  mime: string;
  hintFa: string;
}> = [
  {
    id: "csv-excel",
    labelFa: "اکسل (CSV)",
    ext: "csv",
    mime: "text/csv; charset=utf-8",
    hintFa: "باز شدن درست در اکسل با حفظ صفرهای کدملی — مناسب لیست‌های کوچک/متوسط",
  },
  {
    id: "csv",
    labelFa: "CSV",
    ext: "csv",
    mime: "text/csv; charset=utf-8",
    hintFa: "استاندارد CSV؛ حجم متوسط و سازگار با بیشتر نرم‌افزارها",
  },
  {
    id: "tsv",
    labelFa: "TSV (متن جدولی)",
    ext: "tsv",
    mime: "text/tab-separated-values; charset=utf-8",
    hintFa: "سبک‌ترین و سریع‌ترین خروجی — کمترین زمان انتظار برای لیست‌های بزرگ",
  },
];

export type MostamariExportAdvice = {
  format: MostamariExportFormat;
  reasonFa: string;
  waitTipFa: string;
  /** Rough wall-clock hint for the operator (streaming). */
  etaFa: string;
};

/**
 * Suggest format by row count: Excel-friendly for small lists,
 * lighter CSV mid-range, TSV for large (min wait / size).
 */
export function suggestMostamariExport(
  rowCount: number,
): MostamariExportAdvice {
  const n = Math.max(0, Math.floor(rowCount) || 0);
  const waitTipFa =
    "دانلود به‌صورت جریانی است: مرورگر فایل را همزمان با ساخت ذخیره می‌کند؛ کل فایل در حافظه جمع نمی‌شود.";

  let format: MostamariExportFormat;
  let reasonFa: string;
  if (n <= 15_000) {
    format = "csv-excel";
    reasonFa =
      "تعداد ردیف‌ها متوسط/کم است — قالب اکسل (CSV) برای باز کردن مستقیم در Excel و حفظ کدملی پیشنهاد می‌شود.";
  } else if (n <= 80_000) {
    format = "csv";
    reasonFa =
      "لیست نسبتاً بزرگ است — CSV استاندارد تعادل خوبی بین سازگاری و حجم دارد.";
  } else {
    format = "tsv";
    reasonFa =
      "لیست خیلی بزرگ است — TSV سبک‌ترین قالب است و معمولاً کمترین زمان انتظار را دارد.";
  }

  // Rough ETA: ~2–4k rows/sec streamed on lab; show soft bands only.
  let etaFa: string;
  if (n <= 5_000) etaFa = "معمولاً کمتر از چند ثانیه";
  else if (n <= 30_000) etaFa = "حدود چند ثانیه تا حدود یک دقیقه";
  else if (n <= 100_000) etaFa = "حدود یک تا چند دقیقه (بسته به شبکه و سرور)";
  else etaFa = "چند دقیقه یا بیشتر — پنجرهٔ دانلود مرورگر را باز نگه دارید";

  return { format, reasonFa, waitTipFa, etaFa };
}
