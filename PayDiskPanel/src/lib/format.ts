import { formatShamsiDisplay, isoToShamsi } from "@/lib/shamsi";

/** Parse YYYY-MM-DD (or ISO) as local calendar day — noon avoids TZ day-shift. */
function asLocalDay(value: unknown): Date | null {
  if (value == null || value === "") return null;
  const s = String(value).trim();
  if (!s) return null;
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    const d = new Date(
      Number(ymd[1]),
      Number(ymd[2]) - 1,
      Number(ymd[3]),
      12,
      0,
      0,
    );
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Display dates in Persian locale (hide ugly ISO timestamps). */
export function formatFaDate(value: unknown, withTime = false) {
  if (value == null || value === "") return "—";
  const s = String(value).trim();
  if (!s) return "—";
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd && !withTime) {
    return formatFaDateForTitle(`${ymd[1]}-${ymd[2]}-${ymd[3]}`);
  }
  const d = asLocalDay(s);
  if (!d) {
    // Already a display string (e.g. shamsi) — return as-is
    return s.length > 24 && s.includes("T") ? s.slice(0, 10) : s;
  }
  return withTime
    ? d.toLocaleString("fa-IR")
    : d.toLocaleDateString("fa-IR");
}

/**
 * Persian date for transaction titles, e.g. ۱۴۰۴/۸/۲۴.
 * Input is Gregorian YYYY-MM-DD (still what we save in DB Date).
 */
export function formatFaDateForTitle(isoYmd: string) {
  const raw = isoYmd.trim().slice(0, 10);
  const shamsi = isoToShamsi(raw);
  if (shamsi) return formatShamsiDisplay(shamsi.jy, shamsi.jm, shamsi.jd);
  const d = asLocalDay(isoYmd);
  if (!d) return isoYmd.trim();
  return d.toLocaleDateString("fa-IR");
}

/**
 * Replace Gregorian YYYY-MM-DD (or YYYY/MM/DD) fragments inside a title
 * with Persian dates for display. Does not mutate DB values.
 */
export function formatTxnTitleFa(title: unknown) {
  if (title == null || title === "") return "—";
  const s = String(title);
  return s.replace(
    /\b(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/g,
    (_m, y, m, d) => {
      const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      // Only rewrite plausible Gregorian years (Armaghan titles)
      const year = Number(y);
      if (year < 1900 || year > 2100) return _m;
      return formatFaDateForTitle(iso);
    },
  );
}

/** Default wizard title: «یارانه مراکز شبانه روزی ۱۴۰۵/۸/۲۶» */
export function defaultYaraneTxnTitle(shortFa: string, isoYmd: string) {
  const type = shortFa.trim();
  const dateFa = formatFaDateForTitle(isoYmd);
  const prefix = "یارانه مراکز";
  if (!type) return `${prefix} ${dateFa}`;
  if (type.startsWith(prefix)) return `${type} ${dateFa}`;
  return `${prefix} ${type} ${dateFa}`;
}

/** Shorten long file / token names for table cells */
export function formatShortLabel(value: unknown, max = 28) {
  if (value == null || value === "") return "—";
  const s = String(value).trim();
  if (!s) return "—";
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}
