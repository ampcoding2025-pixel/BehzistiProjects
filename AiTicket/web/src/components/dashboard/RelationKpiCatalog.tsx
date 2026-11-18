"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { ChevronLeft, Search } from "lucide-react";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { EChart } from "@/components/charts/EChart";
import { sortedHorizontalBarOption } from "@/components/charts/sortedHorizontalBar";
import { getAnalyticsProvider } from "@/data/providers";
import { useDashboardFilters } from "@/data/DashboardFilterContext";
import type {
  RelationKpiCatalogData,
  RelationKpiDrillData,
  RelationKpiDrillDimension,
  RelationKpiFeasibility,
  RelationKpiItem,
  RelationKpiTier,
} from "@/data/providers/types";
import { cn, formatFaNumber, formatFaPercent } from "@/lib/utils";

const brand = "#0f766e";
const slate = "#64748b";

const tierLabel: Record<RelationKpiTier, string> = {
  tier1: "سطح ۱ — ضروری",
  tier2: "سطح ۲ — باارزش",
  tier3: "سطح ۳ — پشتیبان",
  tier4: "سطح ۴ — ممیزی",
  tier5: "سطح ۵ — خالی / غیرقابل محاسبه",
};

const feasibilityLabel: Record<RelationKpiFeasibility, string> = {
  feasible: "قابل محاسبه",
  needs_rules: "نیازمند قاعده",
  weak_proxy: "پروکسی ضعیف",
  empty: "قابل محاسبه نیست (خالی)",
  audit: "ممیزی / کم‌اهمیت",
};

const feasibilityStyle: Record<RelationKpiFeasibility, string> = {
  feasible: "bg-teal-50 text-teal-900 border-teal-200",
  needs_rules: "bg-amber-50 text-amber-900 border-amber-200",
  weak_proxy: "bg-slate-50 text-slate-600 border-slate-200",
  empty: "bg-rose-50 text-rose-800 border-rose-200",
  audit: "bg-slate-100 text-slate-600 border-slate-200",
};

const dimensionLabel: Record<RelationKpiDrillDimension, string> = {
  department: "واحد سازمانی",
  region: "استان",
  channel: "کانال",
  subjectClass: "طبقه موضوع",
  subject: "موضوع",
};

type DrillCrumb = {
  dimension: RelationKpiDrillDimension;
  key: string;
  name: string;
};

function formatValue(item: RelationKpiItem) {
  if (item.feasibility === "empty" || item.value == null) return "—";
  if (item.unit === "percent") return formatFaPercent(item.value);
  if (item.unit === "days") return `${formatFaNumber(item.value, 2)} روز`;
  if (item.unit === "ratio") return formatFaNumber(item.value, 2);
  return formatFaNumber(item.value);
}

function formatMetric(value: number, unit: RelationKpiItem["unit"]) {
  if (unit === "percent") return formatFaPercent(value);
  if (unit === "days") return `${formatFaNumber(value, 2)} روز`;
  if (unit === "ratio") return formatFaNumber(value, 2);
  return formatFaNumber(value);
}

function lineOption(series: { label: string; value: number }[], unit: string): EChartsOption {
  return {
    color: [brand],
    textStyle: { fontFamily: "var(--font-vazirmatn), Tahoma, sans-serif" },
    tooltip: {
      trigger: "axis",
      valueFormatter: (v) =>
        unit === "percent" ? formatFaPercent(Number(v)) : formatFaNumber(Number(v), unit === "days" ? 2 : 0),
    },
    grid: { left: 48, right: 16, top: 24, bottom: 40 },
    xAxis: {
      type: "category",
      data: series.map((p) => p.label),
      axisLabel: { color: slate, rotate: series.length > 18 ? 45 : 0, fontSize: 10 },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: slate },
      splitLine: { lineStyle: { color: "#e2e8f0" } },
    },
    series: [
      {
        type: "line",
        smooth: false,
        showSymbol: series.length <= 24,
        symbolSize: 6,
        lineStyle: { width: 3, color: brand },
        areaStyle: { color: "rgba(15,118,110,0.08)" },
        data: series.map((p) => p.value),
      },
    ],
  };
}

function gaugeOption(value: number | null, unit: string): EChartsOption {
  const max =
    unit === "percent" ? 100 : Math.max(10, Math.ceil(((value ?? 0) * 1.25) / 10) * 10 || 100);
  return {
    textStyle: { fontFamily: "var(--font-vazirmatn), Tahoma, sans-serif" },
    series: [
      {
        type: "gauge",
        min: 0,
        max,
        progress: { show: true, width: 14 },
        axisLine: { lineStyle: { width: 14 } },
        axisTick: { show: false },
        splitLine: { length: 8, lineStyle: { width: 2, color: "#E5E7EB" } },
        axisLabel: { distance: 16, color: slate, fontSize: 10 },
        pointer: { length: "60%", width: 5 },
        detail: {
          valueAnimation: true,
          formatter: (v: number) =>
            unit === "percent" ? formatFaPercent(v) : formatFaNumber(v, unit === "days" || unit === "ratio" ? 2 : 0),
          fontSize: 18,
          color: "#0f172a",
          offsetCenter: [0, "70%"],
        },
        data: [{ value: value ?? 0, name: "" }],
        itemStyle: { color: brand },
      },
    ],
  };
}

function pieOption(rows: { name: string; value: number }[]): EChartsOption {
  return {
    textStyle: { fontFamily: "var(--font-vazirmatn), Tahoma, sans-serif" },
    tooltip: { trigger: "item", valueFormatter: (v) => formatFaNumber(Number(v)) },
    series: [
      {
        type: "pie",
        radius: ["42%", "68%"],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 4, borderColor: "#fff", borderWidth: 2 },
        label: { color: slate, fontSize: 11 },
        data: rows.map((r) => ({ name: r.name, value: r.value })),
      },
    ],
  };
}

export function RelationKpiCatalog() {
  const { filters } = useDashboardFilters();
  const [data, setData] = useState<RelationKpiCatalogData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tier, setTier] = useState<"all" | RelationKpiTier>("all");
  const [feasibility, setFeasibility] = useState<"all" | RelationKpiFeasibility>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [drillDimension, setDrillDimension] = useState<RelationKpiDrillDimension | null>(null);
  const [drillStack, setDrillStack] = useState<DrillCrumb[]>([]);
  const [drill, setDrill] = useState<RelationKpiDrillData | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillError, setDrillError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setError(null);
    getAnalyticsProvider()
      .getRelationKpiCatalog(filters)
      .then((res) => {
        if (!alive) return;
        setData(res);
        setSelectedId(res.items.find((i) => i.rank === 1)?.id ?? res.items[0]?.id ?? null);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "خطا در بارگذاری کاتالوگ");
      });
    return () => {
      alive = false;
    };
  }, [filters.period, filters.subjectClassId]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.items.filter((item) => {
      if (tier !== "all" && item.tier !== tier) return false;
      if (feasibility !== "all" && item.feasibility !== feasibility) return false;
      if (query.trim()) {
        const q = query.trim();
        const hay = `${item.id} ${item.name} ${item.definition} ${item.formula} ${item.tables} ${item.emptyBlocker ?? ""}`;
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data, tier, feasibility, query]);

  const selected = useMemo(() => {
    if (!data) return null;
    return data.items.find((i) => i.id === selectedId) ?? filtered[0] ?? data.items[0] ?? null;
  }, [data, selectedId, filtered]);

  useEffect(() => {
    setDrill(null);
    setDrillError(null);
    setDrillStack([]);
    if (!selected || selected.feasibility === "empty" || !selected.drillDimensions.length) {
      setDrillDimension(null);
      return;
    }
    setDrillDimension(selected.drillDimensions[0]);
  }, [selected?.id]);

  const loadDrill = useCallback(
    async (
      code: string,
      dimension: RelationKpiDrillDimension,
      stack: DrillCrumb[],
    ) => {
      setDrillLoading(true);
      setDrillError(null);
      try {
        const parent = stack.length
          ? { dimension: stack[stack.length - 1].dimension, key: stack[stack.length - 1].key }
          : null;
        const res = await getAnalyticsProvider().getRelationKpiDrill(
          code,
          dimension,
          filters,
          parent,
        );
        setDrill(res);
      } catch (err: unknown) {
        setDrill(null);
        setDrillError(err instanceof Error ? err.message : "خطا در بارگذاری تفکیک");
      } finally {
        setDrillLoading(false);
      }
    },
    [filters],
  );

  useEffect(() => {
    if (!selected || !drillDimension || selected.feasibility === "empty") return;
    void loadDrill(selected.id, drillDimension, drillStack);
  }, [selected?.id, drillDimension, drillStack, loadDrill]);

  const primaryChart = useMemo<EChartsOption>(() => {
    if (!selected || selected.feasibility === "empty" || selected.chartType === "none") return {};
    if (selected.chartType === "line" && selected.series?.length) {
      return lineOption(selected.series, selected.unit);
    }
    if ((selected.chartType === "hbar" || selected.chartType === "pie") && selected.breakdown?.length) {
      if (selected.chartType === "pie" || selected.breakdown.length <= 6) {
        return selected.breakdown.length <= 6 && selected.chartType !== "hbar"
          ? pieOption(selected.breakdown)
          : sortedHorizontalBarOption(selected.breakdown, { labelWidth: 120, highlightMax: true });
      }
      return sortedHorizontalBarOption(selected.breakdown, { labelWidth: 120, highlightMax: true });
    }
    if (selected.breakdown?.length) {
      return sortedHorizontalBarOption(selected.breakdown, { labelWidth: 120, highlightMax: true });
    }
    if (selected.series?.length) return lineOption(selected.series, selected.unit);
    return gaugeOption(selected.value, selected.unit);
  }, [selected]);

  const drillChart = useMemo<EChartsOption>(() => {
    if (!drill?.points.length) return {};
    return sortedHorizontalBarOption(
      drill.points.map((p) => ({ name: p.name, value: p.value })),
      { labelWidth: 140, highlightMax: true },
    );
  }, [drill]);

  const onDrillBarClick = useCallback(
    (params: unknown) => {
      if (!selected || !drill || !drill.canDrillFurther || !drill.nextDimension) return;
      const p = params as { name?: string; dataIndex?: number };
      const idx = typeof p.dataIndex === "number" ? p.dataIndex : -1;
      // sortedHorizontalBar sorts ascending — map back by name
      const hit = drill.points.find((x) => x.name === p.name);
      if (!hit) {
        if (idx < 0) return;
        return;
      }
      setDrillStack((prev) => [
        ...prev,
        { dimension: drill.dimension, key: hit.key, name: hit.name },
      ]);
      setDrillDimension(drill.nextDimension);
    },
    [selected, drill],
  );

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-900">
        بارگذاری کاتالوگ ناموفق بود: {error}
      </div>
    );
  }

  if (!data || !selected) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-[var(--muted)]">
        در حال محاسبه شاخص‌ها از دیده‌بان…
      </div>
    );
  }

  const hasChart =
    selected.feasibility !== "empty" &&
    selected.chartType !== "none" &&
    Boolean(selected.series?.length || selected.breakdown?.length || selected.value != null);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-teal-200 bg-teal-50/70 px-4 py-3 text-sm text-teal-950">
        <div className="font-semibold">{data.meta.label}</div>
        <p className="mt-1 text-xs leading-5 text-teal-900/80">{data.meta.note}</p>
        <p className="mt-1 text-[11px] text-teal-800/70">
          {data.meta.periodLabel} · {data.meta.ruleSetVersion} · برای هر شاخص نمودار مناسب و در صورت امکان
          Drill-down ابعاد فعال است
        </p>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {(Object.keys(data.counts) as RelationKpiFeasibility[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFeasibility((prev) => (prev === key ? "all" : key))}
            className={cn(
              "rounded-xl border bg-white p-3 text-right transition",
              feasibility === key
                ? "border-[var(--brand)] ring-2 ring-[var(--brand)]/20"
                : "border-[var(--border)]",
            )}
          >
            <div className="text-[11px] text-[var(--muted)]">{feasibilityLabel[key]}</div>
            <div className="mt-1 text-2xl font-bold text-slate-900">
              {formatFaNumber(data.counts[key])}
            </div>
          </button>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <div className="space-y-4 xl:col-span-2">
          <ChartCard title="فیلتر کاتالوگ رابطه‌ای" subtitle={data.meta.periodLabel}>
            <div className="space-y-3">
              <label className="flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-2">
                <Search className="h-4 w-4 text-[var(--muted)]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="جستجوی کد، نام، جدول یا مانع خالی…"
                  className="w-full bg-transparent text-sm outline-none"
                />
              </label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <select
                  className="rounded-md border border-[var(--border)] bg-white px-2 py-2 text-sm"
                  value={tier}
                  onChange={(e) => setTier(e.target.value as typeof tier)}
                  aria-label="سطح اهمیت"
                >
                  <option value="all">همه سطوح اهمیت</option>
                  {(Object.keys(tierLabel) as RelationKpiTier[]).map((t) => (
                    <option key={t} value={t}>
                      {tierLabel[t]}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-md border border-[var(--border)] bg-white px-2 py-2 text-sm"
                  value={feasibility}
                  onChange={(e) => setFeasibility(e.target.value as typeof feasibility)}
                  aria-label="وضعیت محاسبه"
                >
                  <option value="all">همه وضعیت‌ها</option>
                  {(Object.keys(feasibilityLabel) as RelationKpiFeasibility[]).map((f) => (
                    <option key={f} value={f}>
                      {feasibilityLabel[f]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </ChartCard>

          <ChartCard title="فهرست شاخص‌ها" subtitle={`${formatFaNumber(filtered.length)} مورد`}>
            <ul className="max-h-[640px] space-y-1 overflow-y-auto">
              {filtered.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={cn(
                      "w-full rounded-lg border px-3 py-2.5 text-right transition",
                      selectedId === item.id
                        ? "border-[var(--brand)] bg-[var(--brand-soft)]"
                        : "border-transparent hover:bg-slate-50",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[11px] text-[var(--muted)]">
                          {item.rank != null ? `#${formatFaNumber(item.rank)} · ` : ""}
                          {item.id} · {item.chartType}
                          {item.drillDimensions.length ? " · قابل تفکیک" : ""}
                        </div>
                        <div className="mt-0.5 text-sm font-semibold text-slate-900">{item.name}</div>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium",
                          feasibilityStyle[item.feasibility],
                        )}
                      >
                        {feasibilityLabel[item.feasibility]}
                      </span>
                    </div>
                    <div className="mt-1 text-xs font-semibold text-slate-800">{formatValue(item)}</div>
                  </button>
                </li>
              ))}
            </ul>
          </ChartCard>
        </div>

        <div className="space-y-4 xl:col-span-3">
          <ChartCard title="جزئیات و اندازه‌گیری" subtitle={`${selected.id} — ${selected.name}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded border px-2 py-0.5 text-xs font-medium",
                  feasibilityStyle[selected.feasibility],
                )}
              >
                {feasibilityLabel[selected.feasibility]}
              </span>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                {tierLabel[selected.tier]}
              </span>
              <span className="text-2xl font-bold text-slate-900">{formatValue(selected)}</span>
            </div>

            {selected.feasibility === "empty" ? (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-950">
                <div className="font-semibold">قابل محاسبه نیست چون منبع خالی است</div>
                <p className="mt-1 text-xs leading-6">{selected.emptyBlocker}</p>
              </div>
            ) : null}

            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-lg bg-slate-50 p-3 sm:col-span-2">
                <dt className="text-[11px] text-[var(--muted)]">تعریف</dt>
                <dd className="mt-1 leading-6 text-slate-800">{selected.definition}</dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="text-[11px] text-[var(--muted)]">فرمول</dt>
                <dd className="mt-1 font-mono text-xs leading-6 text-slate-800 dir-ltr text-left">
                  {selected.formula}
                </dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="text-[11px] text-[var(--muted)]">جداول</dt>
                <dd className="mt-1 font-mono text-xs leading-6 text-slate-700 dir-ltr text-left">
                  {selected.tables}
                </dd>
              </div>
              {selected.note ? (
                <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 sm:col-span-2">
                  <dt className="text-[11px] font-semibold text-amber-900">یادداشت</dt>
                  <dd className="mt-1 text-xs leading-6 text-amber-950">{selected.note}</dd>
                </div>
              ) : null}
            </dl>
          </ChartCard>

          {hasChart ? (
            <ChartCard
              title="نمودار شاخص"
              subtitle={
                selected.chartType === "line"
                  ? "روند زمانی"
                  : selected.chartType === "hbar"
                    ? "تفکیک افقی"
                    : selected.chartType === "pie"
                      ? "ترکیب سهمی"
                      : "نمای مقدار"
              }
            >
              <EChart option={primaryChart} height={300} />
            </ChartCard>
          ) : null}

          {selected.drillDimensions.length > 0 && selected.feasibility !== "empty" ? (
            <ChartCard
              title="Drill-down ابعاد"
              subtitle="یک بُعد را انتخاب کنید؛ روی میله کلیک کنید تا عمیق‌تر شوید"
            >
              <div className="mb-3 flex flex-wrap gap-2">
                {selected.drillDimensions.map((dim) => (
                  <button
                    key={dim}
                    type="button"
                    onClick={() => {
                      setDrillStack([]);
                      setDrillDimension(dim);
                    }}
                    className={cn(
                      "rounded-md border px-2.5 py-1.5 text-xs transition",
                      drillDimension === dim && drillStack.length === 0
                        ? "border-[var(--brand)] bg-[var(--brand-soft)] font-semibold text-[var(--brand)]"
                        : "border-[var(--border)] bg-white text-slate-700 hover:bg-slate-50",
                    )}
                  >
                    {dimensionLabel[dim]}
                  </button>
                ))}
              </div>

              {drillStack.length > 0 ? (
                <div className="mb-3 flex flex-wrap items-center gap-1 text-xs text-slate-600">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded border border-[var(--border)] px-2 py-1 hover:bg-slate-50"
                    onClick={() => {
                      setDrillStack([]);
                      if (selected.drillDimensions[0]) setDrillDimension(selected.drillDimensions[0]);
                    }}
                  >
                    ریشه
                  </button>
                  {drillStack.map((c, idx) => (
                    <span key={`${c.dimension}-${c.key}`} className="inline-flex items-center gap-1">
                      <ChevronLeft className="h-3 w-3 text-slate-400" />
                      <button
                        type="button"
                        className="rounded border border-[var(--border)] px-2 py-1 hover:bg-slate-50"
                        onClick={() => {
                          const nextStack = drillStack.slice(0, idx + 1);
                          setDrillStack(nextStack.slice(0, -1));
                          setDrillDimension(c.dimension);
                        }}
                      >
                        {c.name}
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}

              {drillLoading ? (
                <div className="flex h-[280px] items-center justify-center text-sm text-[var(--muted)]">
                  در حال بارگذاری تفکیک…
                </div>
              ) : drillError ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
                  {drillError}
                </div>
              ) : drill?.points.length ? (
                <>
                  <div className="mb-2 text-xs text-[var(--muted)]">
                    {drill.metricLabel} بر اساس {drill.dimensionLabel}
                    {drill.canDrillFurther
                      ? ` · کلیک روی میله → ${dimensionLabel[drill.nextDimension!]}`
                      : " · سطح نهایی"}
                  </div>
                  <EChart
                    option={drillChart}
                    height={320}
                    onEvents={
                      drill.canDrillFurther
                        ? { click: onDrillBarClick }
                        : undefined
                    }
                  />
                  <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-sm">
                    {drill.points.slice(0, 10).map((p) => (
                      <li key={p.key} className="flex justify-between gap-2 border-b border-slate-50 py-1">
                        <span className="text-slate-700">{p.name}</span>
                        <span className="font-semibold tabular-nums">
                          {formatMetric(p.value, drill.unit)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <div className="flex h-[200px] items-center justify-center text-sm text-[var(--muted)]">
                  داده‌ای برای این بُعد نیست
                </div>
              )}
            </ChartCard>
          ) : selected.feasibility !== "empty" ? (
            <ChartCard title="Drill-down" subtitle="برای این شاخص تفکیک ابعادی تعریف نشده">
              <p className="text-sm text-[var(--muted)]">
                شاخص‌های ماهواره‌ای/ممیزی یا منابع بدون بُعد Cookie معمولاً Drill-down ندارند.
              </p>
            </ChartCard>
          ) : null}
        </div>
      </section>
    </div>
  );
}
