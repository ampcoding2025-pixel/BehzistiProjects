export type PeriodKey = "1m" | "30d" | "90d" | "ytd" | "all";

export type AnalyticsQueryFilters = {
  period: PeriodKey;
  /** Didban SubjectClassId; null = all classes */
  subjectClassId: number | null;
  channelId: number | null;
  regionId: number | null;
  subjectGroupId: number | null;
  /** Optional month drill (YYYY-MM-DD); when set, overrides period range */
  from: string | null;
  to: string | null;
  /** CookieFlow status step */
  cookieStatusId: number | null;
  /** CookieFlow.UserId — who acted */
  flowUserId: number | null;
  /** CookieFlow.ReferToUserId — who was referred */
  referUserId: number | null;
  /** Cartable.CartableUserId */
  cartableUserId: number | null;
  /** CallRecord.UserId */
  callUserId: number | null;
  /** Cookie.CookieUserId / UserId */
  caseUserId: number | null;
};

/** Display labels for cross-filter chips (not sent to API). */
export type AnalyticsFilterLabels = {
  subjectClass: string | null;
  channel: string | null;
  region: string | null;
  subjectGroup: string | null;
  month: string | null;
  cookieStatus: string | null;
  flowUser: string | null;
  referUser: string | null;
  cartableUser: string | null;
  callUser: string | null;
  caseUser: string | null;
};

export const DEFAULT_FILTERS: AnalyticsQueryFilters = {
  period: "1m",
  subjectClassId: null,
  channelId: null,
  regionId: null,
  subjectGroupId: null,
  from: null,
  to: null,
  cookieStatusId: null,
  flowUserId: null,
  referUserId: null,
  cartableUserId: null,
  caseUserId: null,
  callUserId: null,
};

export const DEFAULT_FILTER_LABELS: AnalyticsFilterLabels = {
  subjectClass: null,
  channel: null,
  region: null,
  subjectGroup: null,
  month: null,
  cookieStatus: null,
  flowUser: null,
  referUser: null,
  cartableUser: null,
  callUser: null,
  caseUser: null,
};

/** Confirmed in docs/04 + inspection: شکایت = 1. Other class IDs left unset until confirmed. */
export const SUBJECT_CLASS_OPTIONS: { value: string; label: string; id: number | null }[] = [
  { value: "all", label: "همه طبقات", id: null },
  { value: "complaint", label: "شکایت", id: 1 },
];

export function periodToRange(period: PeriodKey): { from?: string; to?: string; label: string } {
  const today = new Date();
  const iso = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  if (period === "all") {
    return { label: "کل دوره تاریخی" };
  }

  if (period === "1m") {
    // Previous calendar month (local)
    const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const to = new Date(today.getFullYear(), today.getMonth(), 0);
    return {
      from: iso(from),
      to: iso(to),
      label: "ماه گذشته",
    };
  }

  if (period === "ytd") {
    const from = new Date(today.getFullYear(), 0, 1);
    return { from: iso(from), to: iso(today), label: "از ابتدای سال میلادی تا امروز" };
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

/** Parse chart month label `YYYY/MM` into inclusive ISO date range. */
export function monthLabelToRange(label: string): { from: string; to: string } | null {
  const m = /^(\d{4})\/(\d{2})$/.exec(label.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isFinite(year) || month < 1 || month > 12) return null;
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 0));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

export function filtersToQuery(filters: AnalyticsQueryFilters): string {
  const params = new URLSearchParams();
  if (filters.from && filters.to) {
    params.set("from", filters.from);
    params.set("to", filters.to);
  } else {
    const range = periodToRange(filters.period);
    if (range.from) params.set("from", range.from);
    if (range.to) params.set("to", range.to);
  }
  if (filters.subjectClassId != null) params.set("subjectClassId", String(filters.subjectClassId));
  if (filters.channelId != null) params.set("channelId", String(filters.channelId));
  if (filters.regionId != null) params.set("regionId", String(filters.regionId));
  if (filters.subjectGroupId != null) params.set("subjectGroupId", String(filters.subjectGroupId));
  if (filters.cookieStatusId != null) params.set("cookieStatusId", String(filters.cookieStatusId));
  if (filters.flowUserId != null) params.set("flowUserId", String(filters.flowUserId));
  if (filters.referUserId != null) params.set("referUserId", String(filters.referUserId));
  if (filters.cartableUserId != null) params.set("cartableUserId", String(filters.cartableUserId));
  if (filters.callUserId != null) params.set("callUserId", String(filters.callUserId));
  if (filters.caseUserId != null) params.set("caseUserId", String(filters.caseUserId));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function filtersKey(filters: AnalyticsQueryFilters): string {
  return [
    filters.period,
    filters.from ?? "",
    filters.to ?? "",
    filters.subjectClassId ?? "all",
    filters.channelId ?? "all",
    filters.regionId ?? "all",
    filters.subjectGroupId ?? "all",
    filters.cookieStatusId ?? "all",
    filters.flowUserId ?? "all",
    filters.referUserId ?? "all",
    filters.cartableUserId ?? "all",
    filters.callUserId ?? "all",
    filters.caseUserId ?? "all",
  ].join("|");
}

export function hasDimensionFilters(filters: AnalyticsQueryFilters): boolean {
  return (
    filters.subjectClassId != null ||
    filters.channelId != null ||
    filters.regionId != null ||
    filters.subjectGroupId != null ||
    (filters.from != null && filters.to != null) ||
    filters.cookieStatusId != null ||
    filters.flowUserId != null ||
    filters.referUserId != null ||
    filters.cartableUserId != null ||
    filters.callUserId != null ||
    filters.caseUserId != null
  );
}
