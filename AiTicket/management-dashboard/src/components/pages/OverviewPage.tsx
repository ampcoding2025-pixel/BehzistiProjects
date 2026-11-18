"use client";

import { useEffect, useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { EChart } from "@/components/charts/EChart";
import { KpiCard } from "@/components/ui/KpiCard";
import { Panel } from "@/components/ui/Panel";
import { managementApi, type OverviewData } from "@/data/api";
import { useFilters } from "@/data/FilterContext";
import { formatFaNumber, formatFaPercent } from "@/lib/utils";

const brand = "#1d4ed8";
const slate = "#64748b";
const green = "#15803d";
const orange = "#c2410c";

const KPI_DRILL: Record<string, { href: string; hint: string }> = {
  inflow: { href: "/demand", hint: "کلیک برای تحلیل تقاضا ←" },
  finished: { href: "/resolution", hint: "کلیک برای عملکرد رسیدگی ←" },
  open: { href: "/backlog", hint: "کلیک برای پرونده‌های باز ←" },
  complaintShare: { href: "/demand", hint: "کلیک برای ترکیب تقاضا ←" },
  medianDays: { href: "/resolution", hint: "کلیک برای زمان رسیدگی ←" },
  withPursuit: { href: "/resolution", hint: "کلیک برای پیگیری‌ها ←" },
};

export function OverviewPage() {
  const { filters, setRegionId } = useFilters();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regions, setRegions] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    managementApi
      .overview(filters)
      .then((res) => {
        if (alive) setData(res);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : "خطا");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [filters]);

  useEffect(() => {
    let alive = true;
    managementApi
      .provinces({ period: "all", regionId: null, subjectClassId: null })
      .then((r) => {
        if (alive) setRegions(r.provinces.map((p) => ({ id: p.id, name: p.name })));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const throughputOption = useMemo<EChartsOption>(() => {
    if (!data?.throughputTrend.length) return {};
    const labels = data.throughputTrend.map((p) => p.label);
    return {
      textStyle: { fontFamily: "var(--font-vazirmatn), Tahoma, sans-serif" },
      tooltip: { trigger: "axis" },
      legend: { data: ["ورودی", "خاتمه‌یافته", "خالص تغییر بار"], bottom: 0 },
      grid: { left: 48, right: 24, top: 24, bottom: 48 },
      xAxis: { type: "category", data: labels, axisLabel: { color: slate, rotate: 40, fontSize: 10 } },
      yAxis: { type: "value", axisLabel: { color: slate }, splitLine: { lineStyle: { color: "#eef2f7" } } },
      series: [
        {
          name: "ورودی",
          type: "bar",
          data: data.throughputTrend.map((p) => p.inflow),
          itemStyle: { color: brand },
          barMaxWidth: 18,
        },
        {
          name: "خاتمه‌یافته",
          type: "line",
          data: data.throughputTrend.map((p) => p.finished),
          itemStyle: { color: green },
          lineStyle: { width: 2 },
        },
        {
          name: "خالص تغییر بار",
          type: "line",
          data: data.throughputTrend.map((p) => p.netChange),
          itemStyle: { color: orange },
          lineStyle: { width: 2, type: "dashed" },
        },
      ],
    };
  }, [data]);

  const provinceOption = useMemo<EChartsOption>(() => {
    const rows = [...(data?.mapMetric.provinces ?? [])].sort((a, b) => a.value - b.value).slice(-12);
    return {
      textStyle: { fontFamily: "var(--font-vazirmatn), Tahoma, sans-serif" },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      grid: { left: 110, right: 36, top: 8, bottom: 24 },
      xAxis: { type: "value", axisLabel: { color: slate } },
      yAxis: {
        type: "category",
        data: rows.map((r) => r.name),
        axisLabel: { color: slate, width: 100, overflow: "truncate" },
      },
      series: [
        {
          type: "bar",
          data: rows.map((r) => r.value),
          itemStyle: { color: brand },
          barWidth: 12,
          label: { show: true, position: "right", formatter: (p) => formatFaNumber(Number(p.value)) },
        },
      ],
    };
  }, [data]);

  const applyProvince = (name: string) => {
    const hit = regions.find((r) => r.name === name);
    if (hit) setRegionId(hit.id);
  };

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        بارگذاری نمای کلان ناموفق بود. API را روی پورت ۵۰۸۸ بررسی کنید.
        <pre className="mt-2 whitespace-pre-wrap text-xs">{error}</pre>
      </div>
    );
  }

  if (!data) {
    return <div className="py-20 text-center text-sm text-[var(--muted)]">در حال محاسبه شاخص‌های مدیریتی…</div>;
  }

  return (
    <div className="relative space-y-5">
      {loading ? (
        <div className="absolute inset-x-0 top-0 z-10 rounded-md bg-blue-50/90 px-3 py-1.5 text-center text-xs text-blue-800">
          در حال به‌روزرسانی با فیلترهای فعال…
        </div>
      ) : null}

      {data.meta.warnings?.length ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-950">
          {data.meta.warnings.join(" · ")} · {data.meta.periodLabel} · {data.ruleSetVersion}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {data.kpis.map((k) => {
          const drill = KPI_DRILL[k.id];
          return <KpiCard key={k.id} {...k} href={drill?.href} hrefHint={drill?.hint} />;
        })}
      </section>

      <Panel title="روند ورود و خاتمه" subtitle="ستون ورودی · خط خاتمه · خط‌چین خالص تغییر بار">
        <div className="mb-2 text-left">
          <a href="/demand" className="text-xs font-medium text-blue-700 hover:underline">
            مشاهده در تحلیل تقاضا ←
          </a>
        </div>
        <EChart
          option={throughputOption}
          height={320}
          onEvents={{
            click: () => {
              window.location.href = "/demand";
            },
          }}
        />
      </Panel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="موضوعات دارای بیشترین تغییر" subtitle="کلیک روی ردیف → ریشه‌یابی">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-right text-sm">
              <thead className="text-[11px] text-[var(--muted)]">
                <tr className="border-b border-slate-200">
                  <th className="px-2 py-2 font-medium">موضوع</th>
                  <th className="px-2 py-2 font-medium">تعداد</th>
                  <th className="px-2 py-2 font-medium">سهم</th>
                  <th className="px-2 py-2 font-medium">تغییر</th>
                  <th className="px-2 py-2 font-medium">روند</th>
                  <th className="px-2 py-2 font-medium">اولویت</th>
                </tr>
              </thead>
              <tbody>
                {data.topChangingTopics.map((t) => (
                  <tr key={t.id} className="border-b border-slate-50 hover:bg-blue-50">
                    <td className="px-2 py-2" colSpan={6}>
                      <a href="/critical" className="grid grid-cols-6 gap-2 text-slate-800">
                        <span className="col-span-1 truncate">{t.name}</span>
                        <span className="tabular-nums">{formatFaNumber(t.count)}</span>
                        <span className="tabular-nums">{formatFaPercent(t.sharePercent)}</span>
                        <span className="tabular-nums">
                          {t.deltaPercent == null ? "—" : `${formatFaNumber(t.deltaPercent, 1)}٪`}
                        </span>
                        <span>{t.trend === "up" ? "افزایشی" : t.trend === "down" ? "کاهشی" : "پایدار"}</span>
                        <span
                          className={
                            t.priority === "high"
                              ? "text-red-700"
                              : t.priority === "medium"
                                ? "text-orange-700"
                                : "text-slate-500"
                          }
                        >
                          {t.priority === "high" ? "بالا" : t.priority === "medium" ? "متوسط" : "کم"}
                        </span>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="وضعیت استانی (حجم پرونده)" subtitle="کلیک روی استان → فیلتر و صفحه استانی">
          <EChart
            option={provinceOption}
            height={300}
            onEvents={{
              click: (p) => {
                const name = (p as { name?: string }).name;
                if (name) {
                  applyProvince(name);
                  window.location.href = "/provinces";
                }
              },
            }}
          />
          <ul className="mt-3 space-y-1 text-sm">
            {data.topAttentionProvinces.map((p) => (
              <li key={p.name}>
                <a
                  href="/provinces"
                  onClick={() => applyProvince(p.name)}
                  className="flex w-full justify-between border-b border-slate-50 py-1 text-right hover:bg-blue-50"
                >
                  <span>{p.name}</span>
                  <span className="font-semibold tabular-nums">{formatFaNumber(p.value)}</span>
                </a>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="مهم‌ترین هشدارهای مدیریتی">
          <ul className="space-y-3">
            {data.alerts.map((a) => {
              const href =
                a.change.includes("باز") || a.suggestedReview.includes("باز")
                  ? "/backlog"
                  : a.change.includes("استان") || a.where.includes("تهران")
                    ? "/provinces"
                    : "/critical";
              return (
                <li key={a.id}>
                  <a
                    href={href}
                    className="block w-full rounded-md border border-[var(--border)] bg-slate-50 p-3 text-right text-sm transition hover:border-blue-300 hover:bg-blue-50"
                  >
                    <div className="font-semibold text-slate-900">۱. {a.change}</div>
                    <div className="mt-1 text-[12px] text-slate-600">۲. محل: {a.where}</div>
                    <div className="mt-1 text-[12px] text-slate-600">۳. اثر: {a.impact}</div>
                    <div className="mt-1 text-[12px] text-blue-800">۴. پیشنهاد بررسی: {a.suggestedReview}</div>
                  </a>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel title="اولویت‌های پیشنهادی مدیریت" subtitle="کلیک برای رفتن به صفحه مرتبط">
          <ul className="space-y-3">
            {data.priorities.map((p) => {
              const href = p.title.includes("جغرافیایی") ? "/provinces" : "/critical";
              return (
                <li key={p.id}>
                  <a
                    href={href}
                    onClick={() => {
                      const region = regions.find((r) => r.name === p.relatedUnitOrProvince);
                      if (region) setRegionId(region.id);
                    }}
                    className="block w-full rounded-md border border-[var(--border)] p-3 text-right text-sm transition hover:border-blue-300 hover:bg-blue-50"
                  >
                    <div className="font-semibold text-slate-900">{p.title}</div>
                    <div className="mt-1 text-[12px] text-slate-600">شواهد: {p.evidence}</div>
                    <div className="mt-1 text-[12px] text-slate-600">مرتبط: {p.relatedUnitOrProvince}</div>
                    <div className="mt-1 text-[12px] text-slate-600">روند: {p.trend}</div>
                    <div className="mt-1 text-[12px] font-medium text-blue-800">{p.suggestedAction}</div>
                  </a>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
