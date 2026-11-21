"use client";

import { useEffect, useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { EChart } from "@/components/charts/EChart";
import { getAnalyticsProvider } from "@/data/providers";
import type { AnalyticsQueryFilters } from "@/data/filters";
import type { UserRateTrendData, UserWorkloadRole } from "@/data/providers/types";
import {
  bandLabelFa,
  bandToneClass,
  type UserScorecardModel,
} from "@/lib/userPerformanceScore";
import { cn, formatFaNumber } from "@/lib/utils";

function Meter({
  label,
  value,
  note,
}: {
  label: string;
  value: number | null;
  note: string;
}) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium text-slate-800">{label}</span>
        <span className="tabular-nums text-slate-900">
          {value == null ? "—" : formatFaNumber(value, 1)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-[var(--brand)] transition-[width]"
          style={{ width: value == null ? "0%" : `${pct}%` }}
        />
      </div>
      <p className="text-[11px] leading-relaxed text-slate-500">{note}</p>
    </div>
  );
}

function rateTrendOption(trend: UserRateTrendData | null): EChartsOption {
  if (!trend?.points.length) return {};
  const labels = trend.points.map((p) => p.label);
  const rates = trend.points.map((p) =>
    p.rate != null && Number.isFinite(p.rate) ? Math.round(p.rate * 10) / 10 : null,
  );
  return {
    animation: false,
    textStyle: { fontFamily: "var(--font-vazirmatn), Tahoma, sans-serif" },
    tooltip: {
      trigger: "axis",
      formatter: (params: unknown) => {
        const row = Array.isArray(params) ? params[0] : params;
        const p = row as { dataIndex?: number };
        const point = trend.points[p.dataIndex ?? 0];
        if (!point) return "";
        const rateTxt = point.rate == null ? "—" : formatFaNumber(point.rate, 1);
        const daysTxt = point.avgHours == null ? "—" : formatFaNumber(point.avgHours, 1);
        return `${point.label}<br/>نرخ: ${rateTxt}<br/>حجم: ${formatFaNumber(point.load)}<br/>میانگین ساعت: ${daysTxt}`;
      },
    },
    grid: { left: 44, right: 16, top: 28, bottom: 36 },
    xAxis: {
      type: "category",
      data: labels,
      boundaryGap: false,
      axisLabel: { color: "#64748b", fontSize: 10, rotate: labels.length > 6 ? 30 : 0 },
    },
    yAxis: {
      type: "value",
      name: "نرخ",
      nameTextStyle: { color: "#64748b", fontSize: 10 },
      axisLabel: { color: "#64748b", fontSize: 10 },
      splitLine: { lineStyle: { color: "#eef2f7" } },
    },
    series: [
      {
        id: "user-rate-line",
        name: "نرخ (حجم÷ساعت)",
        type: "line",
        smooth: 0.35,
        showSymbol: true,
        symbolSize: 8,
        connectNulls: false,
        lineStyle: { width: 3, color: "#0f766e" },
        itemStyle: { color: "#0f766e" },
        areaStyle: { color: "rgba(15,118,110,0.12)" },
        data: rates,
      },
    ],
  };
}

export function UserScoreCardPanel({
  model,
  periodLabel,
  role,
  filters,
  isBestDefault,
  onShowBest,
  onFilter,
}: {
  model: UserScorecardModel;
  periodLabel: string;
  role: UserWorkloadRole;
  filters: AnalyticsQueryFilters;
  isBestDefault: boolean;
  onShowBest?: () => void;
  onFilter?: () => void;
}) {
  const { breakdown } = model;
  const [trend, setTrend] = useState<UserRateTrendData | null>(null);
  const [chartsLoading, setChartsLoading] = useState(false);

  useEffect(() => {
    if (model.userId == null) return;
    let alive = true;
    setChartsLoading(true);
    getAnalyticsProvider()
      .getUserRateTrend(model.userId, role, filters)
      .then((rateRes) => {
        if (!alive) return;
        setTrend(rateRes);
      })
      .catch(() => {
        if (!alive) return;
        setTrend(null);
      })
      .finally(() => {
        if (alive) setChartsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [model.userId, role, filters]);

  const chartOption = useMemo(() => rateTrendOption(trend), [trend]);
  const currentRate =
    model.avgHours != null && model.avgHours > 0 ? model.volume / model.avgHours : null;

  return (
    <section
      className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-5"
      aria-label="کارت امتیاز عملکرد کاربر"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500">
            {model.roleLabel}
            {isBestDefault ? " · پیش‌فرض: بهترین عملکرد" : " · انتخاب‌شده از نمودار"}
          </p>
          <h3 className="mt-0.5 text-lg font-bold text-slate-900">{model.name}</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">بازه «{periodLabel}»</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isBestDefault && onShowBest ? (
            <button
              type="button"
              onClick={onShowBest}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
            >
              نمایش بهترین
            </button>
          ) : null}
          {onFilter ? (
            <button
              type="button"
              onClick={onFilter}
              className="rounded-md bg-[var(--brand)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
            >
              فیلتر این کاربر
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <div
            className={cn(
              "flex items-center justify-between gap-3 rounded-lg border px-4 py-3",
              bandToneClass(breakdown.band),
            )}
          >
            <div>
              <p className="text-xs font-medium opacity-80">امتیاز عملکرد</p>
              <p className="mt-0.5 text-3xl font-bold tabular-nums">
                {formatFaNumber(breakdown.score, 1)}
                <span className="mr-1 text-sm font-medium opacity-70">/ ۱۰۰</span>
              </p>
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold">{bandLabelFa(breakdown.band)}</p>
              <p className="mt-0.5 text-xs opacity-80">
                رتبه {formatFaNumber(model.peerRank)} از {formatFaNumber(model.peerCount)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-lg border border-slate-100 px-3 py-2">
              <p className="text-xs text-slate-500">حجم</p>
              <p className="mt-0.5 font-semibold tabular-nums text-slate-900">
                {formatFaNumber(model.volume)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 px-3 py-2">
              <p className="text-xs text-slate-500">میانگین ساعت</p>
              <p className="mt-0.5 font-semibold tabular-nums text-slate-900">
                {model.avgHours == null || !Number.isFinite(model.avgHours)
                  ? "—"
                  : formatFaNumber(model.avgHours, 1)}
              </p>
            </div>
            <div className="rounded-lg border border-teal-100 bg-teal-50/60 px-3 py-2">
              <p className="text-xs text-teal-800">نرخ (حجم÷ساعت)</p>
              <p className="mt-0.5 font-semibold tabular-nums text-teal-950">
                {currentRate == null ? "—" : formatFaNumber(currentRate, 1)}
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-[12px] leading-relaxed text-slate-600">
            <p className="font-medium text-slate-800">فرمول</p>
            <p className="mt-1">{breakdown.formulaFa}</p>
            <p className="mt-1 text-[11px] text-slate-500">
              نرخ = حجم ÷ میانگین ساعت · کلیک روی نام کاربر در نمودارها این کارت را عوض می‌کند
            </p>
          </div>

          <div className="space-y-3">
            <Meter label="امتیاز حجم" value={breakdown.loadIndex} note={breakdown.loadNote} />
            <Meter label="امتیاز سرعت" value={breakdown.speedIndex} note={breakdown.speedNote} />
            <Meter
              label="شاخص نرخ"
              value={breakdown.throughputIndex}
              note={breakdown.throughputNote}
            />
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-slate-800">منحنی نرخ ماهانه</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {trend?.formula ?? "نرخ = حجم ÷ میانگین ساعت در هر ماه"}
          </p>
          {chartsLoading ? (
            <p className="flex h-[200px] items-center justify-center text-sm text-slate-500">
              در حال بارگذاری نمودارها…
            </p>
          ) : (
            <div className="mt-2">
              <EChart
                option={chartOption}
                height={200}
                ariaLabel="منحنی نرخ ماهانه کاربر"
                emptyMessage="نقطه‌ای برای منحنی نرخ نیست"
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
