/**
 * Jalali ↔ Gregorian helpers (no external deps for conversion).
 * Algorithms based on common civil calendar conversions.
 */

export type ShamsiYmd = { jy: number; jm: number; jd: number };

function div(a: number, b: number) {
  return Math.trunc(a / b);
}

/** Gregorian YYYY-MM-DD → Jalali parts */
export function gregorianToJalali(gy: number, gm: number, gd: number): ShamsiYmd {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = gy <= 1600 ? 0 : 979;
  gy -= gy <= 1600 ? 621 : 1600;
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    365 * gy +
    div(gy2 + 3, 4) -
    div(gy2 + 99, 100) +
    div(gy2 + 399, 400) -
    80 +
    gd +
    g_d_m[gm - 1]!;
  jy += 33 * div(days, 12053);
  days %= 12053;
  jy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) {
    jy += div(days - 1, 365);
    days = (days - 1) % 365;
  }
  const jm = days < 186 ? 1 + div(days, 31) : 7 + div(days - 186, 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return { jy, jm, jd };
}

/** Jalali → Gregorian parts */
export function jalaliToGregorian(jy: number, jm: number, jd: number) {
  let gy = jy <= 979 ? 621 : 1600;
  jy -= jy <= 979 ? 0 : 979;
  const days =
    365 * jy +
    div(jy, 33) * 8 +
    div((jy % 33) + 3, 4) +
    78 +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  gy += 400 * div(days, 146097);
  let d = days % 146097;
  if (d >= 36525) {
    gy += 100 * div(--d, 36524);
    d %= 36524;
    if (d >= 365) d++;
  }
  gy += 4 * div(d, 1461);
  d %= 1461;
  if (d >= 366) {
    gy += div(d - 1, 365);
    d = (d - 1) % 365;
  }
  const sal_a = [
    0,
    31,
    (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  let gm = 0;
  for (gm = 0; gm < 13 && d >= sal_a[gm]!; gm++) d -= sal_a[gm]!;
  return { gy, gm, gd: d + 1 };
}

export function isoToShamsi(isoYmd: string): ShamsiYmd | null {
  const m = isoYmd.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return gregorianToJalali(Number(m[1]), Number(m[2]), Number(m[3]));
}

export function shamsiToIso(jy: number, jm: number, jd: number): string {
  const { gy, gm, gd } = jalaliToGregorian(jy, jm, jd);
  return `${gy}-${String(gm).padStart(2, "0")}-${String(gd).padStart(2, "0")}`;
}

export function formatShamsiDisplay(jy: number, jm: number, jd: number) {
  const fa = (n: number) =>
    String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]!);
  return `${fa(jy)}/${fa(jm)}/${fa(jd)}`;
}

/** Ops PayedTransaction.Year — Jalali YYYYMM from a Gregorian Date (default: now). */
export function jalaliYearMonth(from: Date = new Date()): string {
  const { jy, jm } = gregorianToJalali(
    from.getFullYear(),
    from.getMonth() + 1,
    from.getDate(),
  );
  return `${jy}${String(jm).padStart(2, "0")}`;
}

/** Jalali YYYYMM from ISO YYYY-MM-DD (e.g. RelatedTo / registration). */
export function jalaliYearMonthFromIso(isoYmd: string): string | null {
  const parts = isoToShamsi(isoYmd.slice(0, 10));
  if (!parts) return null;
  return `${parts.jy}${String(parts.jm).padStart(2, "0")}`;
}

export const JALALI_MONTHS_FA = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
] as const;

/** Days in Jalali month */
export function jalaliMonthLength(jy: number, jm: number) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  const a = jalaliToGregorian(jy, 1, 1);
  const b = jalaliToGregorian(jy + 1, 1, 1);
  const d1 = Date.UTC(a.gy, a.gm - 1, a.gd);
  const d2 = Date.UTC(b.gy, b.gm - 1, b.gd);
  return (d2 - d1) / 86400000 === 366 ? 30 : 29;
}
