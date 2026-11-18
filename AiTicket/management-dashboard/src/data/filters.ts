export type PeriodKey = "30d" | "90d" | "ytd" | "all";

export type MgmtFilters = {
  period: PeriodKey;
  regionId: number | null;
  subjectClassId: number | null;
};

export const DEFAULT_FILTERS: MgmtFilters = {
  period: "ytd",
  regionId: null,
  subjectClassId: null,
};

export const PERIOD_OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: "30d", label: "۳۰ روز اخیر" },
  { value: "90d", label: "۹۰ روز اخیر" },
  { value: "ytd", label: "از ابتدای سال" },
  { value: "all", label: "کل دوره تاریخی" },
];

export const SUBJECT_CLASS_OPTIONS: { id: number | null; label: string }[] = [
  { id: null, label: "همه انواع موضوع" },
  { id: 1, label: "شکایت" },
  { id: 3, label: "راهنمایی و ارشاد" },
  { id: 4, label: "گزارش" },
  { id: 5, label: "پیشنهاد" },
];

export function periodToRange(period: PeriodKey): { from?: string; to?: string; label: string } {
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (period === "all") return { label: "کل دوره تاریخی" };
  if (period === "ytd") {
    return {
      from: iso(new Date(today.getFullYear(), 0, 1)),
      to: iso(today),
      label: "از ابتدای سال میلادی",
    };
  }
  const days = period === "30d" ? 30 : 90;
  const from = new Date(today);
  from.setDate(from.getDate() - days);
  return {
    from: iso(from),
    to: iso(today),
    label: period === "30d" ? "۳۰ روز اخیر" : "۹۰ روز اخیر",
  };
}

export function filtersToQuery(filters: MgmtFilters): string {
  const params = new URLSearchParams();
  const range = periodToRange(filters.period);
  if (range.from) params.set("from", range.from);
  if (range.to) params.set("to", range.to);
  if (filters.regionId != null) params.set("regionId", String(filters.regionId));
  if (filters.subjectClassId != null) params.set("subjectClassId", String(filters.subjectClassId));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}
