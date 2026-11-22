import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/** Convert ASCII / Arabic-Indic digits to Persian digits. */
export function toFaDigits(input: string | number): string {
  return String(input)
    .replace(/\d/g, (d) => FA_DIGITS[Number(d)]!)
    .replace(/[٠-٩]/g, (d) => FA_DIGITS["٠١٢٣٤٥٦٧٨٩".indexOf(d)]!);
}

/** Normalize Persian/Arabic digits to ASCII for parsing. */
export function toEnDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

export function formatFaNumber(value: number, digits = 0) {
  return new Intl.NumberFormat("fa-IR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

export function formatFaPercent(value: number, digits = 1) {
  return `${formatFaNumber(value, digits)}٪`;
}

/** Display an ISO `YYYY-MM-DD` (or Date) as Jalali with Persian digits. */
export function formatFaDate(isoOrDate: string | Date): string {
  const d =
    typeof isoOrDate === "string"
      ? new Date(`${toEnDigits(isoOrDate).slice(0, 10)}T12:00:00`)
      : isoOrDate;
  if (Number.isNaN(d.getTime())) {
    return toFaDigits(String(isoOrDate));
  }
  return new Intl.DateTimeFormat("fa-IR", {
    calendar: "persian",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Chart month key `YYYY/MM` → Jalali month label (e.g. مهر ۱۴۰۴). */
export function formatFaMonthLabel(ym: string): string {
  const en = toEnDigits(ym).trim().replace("-", "/");
  const m = /^(\d{4})\/(\d{2})$/.exec(en);
  if (!m) return toFaDigits(ym);
  const d = new Date(Number(m[1]), Number(m[2]) - 1, 15);
  if (Number.isNaN(d.getTime())) return toFaDigits(ym);
  return new Intl.DateTimeFormat("fa-IR", {
    calendar: "persian",
    year: "numeric",
    month: "long",
  }).format(d);
}

/** Turn API period text like `2026-10-01 → 2026-10-31` into Jalali Persian digits. */
export function formatFaPeriodLabel(label: string): string {
  const en = toEnDigits(label);
  return en.replace(/\d{4}-\d{2}-\d{2}/g, (iso) => formatFaDate(iso));
}
