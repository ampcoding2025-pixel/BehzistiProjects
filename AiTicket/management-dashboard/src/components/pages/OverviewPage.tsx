"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EChartsOption } from "echarts";
import { EChart } from "@/components/charts/EChart";
import { KpiCard } from "@/components/ui/KpiCard";
import { Panel } from "@/components/ui/Panel";
import { managementApi, type ApiKpi, type OverviewData, type ResolutionData } from "@/data/api";
import { useFilters } from "@/data/FilterContext";
import { formatFaNumber, formatFaPercent } from "@/lib/utils";

const brand = "#1d4ed8";
const slate = "#64748b";
const green = "#15803d";
const orange = "#c2410c";

const CASE_KPI_IDS = ["inflow", "finished", "open", "median-days", "pursuits"];
const COMPLAINT_KPIS: { id: string; label: string; source: "overview" | "resolution" }[] = [
  { id: "complaint-count", label: "شکایات ثبت‌شده", source: "overview" },
  { id: "finished", label: "شکایات مختومه از ورودی بازه", source: "overview" },
  { id: "open", label: "شکایات باز از ورودی بازه", source: "overview" },
  { id: "average-days", label: "میانگین زمان رسیدگی شکایات", source: "resolution" },
  { id: "pursuits", label: "شکایات دارای پیگیری", source: "overview" },
];
const MOCK_HBI_COMPONENTS = [
  { label: "ماندگاری پرونده‌های باز", value: 76 },
  { label: "تأخیر گردش کار", value: 64 },
  { label: "توازن ورودی و خروجی", value: 68 },
  { label: "تمرکز بار واحدها", value: 62 },
];
const MOCK_HBI_SCORE = 68;

const KPI_DRILL: Record<string, { href: string; hint: string }> = {
  inflow: { href: "/demand", hint: "کلیک برای تحلیل تقاضا ←" },
  "complaint-count": { href: "/demand", hint: "کلیک برای تحلیل شکایات ←" },
  finished: { href: "/resolution", hint: "کلیک برای عملکرد رسیدگی ←" },
  open: { href: "/backlog", hint: "کلیک برای پرونده‌های باز ←" },
  "complaint-share": { href: "/demand", hint: "کلیک برای ترکیب تقاضا ←" },
  "median-days": { href: "/resolution", hint: "کلیک برای زمان رسیدگی ←" },
  pursuits: { href: "/resolution", hint: "کلیک برای پیگیری‌ها ←" },
};

export function OverviewPage() {
  const router = useRouter();
  const { filters, setRegionId, setSubjectClassId } = useFilters();
  const [data, setData] = useState<OverviewData | null>(null);
  const [caseKpiData, setCaseKpiData] = useState<OverviewData | null>(null);
  const [complaintData, setComplaintData] = useState<{
    overview: OverviewData;
    resolution: ResolutionData;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [caseKpiError, setCaseKpiError] = useState<string | null>(null);
  const [complaintError, setComplaintError] = useState<string | null>(null);
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
    setCaseKpiData(null);
    setCaseKpiError(null);
    managementApi
      .overview({ ...filters, subjectClassId: null })
      .then((res) => {
        if (alive) setCaseKpiData(res);
      })
      .catch((e: unknown) => {
        if (alive) setCaseKpiError(e instanceof Error ? e.message : "خطا");
      });
    return () => {
      alive = false;
    };
  }, [filters]);

  useEffect(() => {
    let alive = true;
    const complaintFilters = { ...filters, subjectClassId: 1 };
    setComplaintError(null);
    setComplaintData(null);
    Promise.all([
      managementApi.overview(complaintFilters),
      managementApi.resolution(complaintFilters),
    ])
      .then(([overview, resolution]) => {
        if (alive) setComplaintData({ overview, resolution });
      })
      .catch((e: unknown) => {
        if (alive) setComplaintError(e instanceof Error ? e.message : "خطا");
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
      legend: { data: ["ورودی", "مختومه", "خالص تغییر بار"], bottom: 0 },
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
          name: "مختومه",
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

  const caseKpis = caseKpiData?.kpis.filter((kpi) => CASE_KPI_IDS.includes(kpi.id));
  const complaintKpiValues = new Map<string, ApiKpi>();
  for (const kpi of complaintData?.overview.kpis ?? []) complaintKpiValues.set(`overview:${kpi.id}`, kpi);
  for (const kpi of complaintData?.resolution.kpis ?? []) complaintKpiValues.set(`resolution:${kpi.id}`, kpi);

  return (
    <div className="relative space-y-5">
      {loading ? (
        <div className="absolute inset-x-0 top-0 z-10 rounded-md bg-blue-50/90 px-3 py-1.5 text-center text-xs text-blue-800">
          در حال به‌روزرسانی با فیلترهای فعال…
        </div>
      ) : null}

      <section aria-labelledby="case-kpis-heading" className="space-y-3">
        <h2 id="case-kpis-heading" className="text-base font-semibold text-[var(--foreground)]">
          شاخص‌های پرونده‌ها · همه انواع موضوع
        </h2>
        {caseKpiError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            بارگذاری شاخص‌های پرونده‌ها ناموفق بود.
            <pre className="mt-1 whitespace-pre-wrap text-xs">{caseKpiError}</pre>
          </div>
        ) : caseKpis ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            {caseKpis.map((kpi) => {
              const drill = KPI_DRILL[kpi.id];
              return (
                <KpiCard
                  key={kpi.id}
                  {...kpi}
                  label={
                    kpi.id === "finished"
                      ? "پرونده‌های مختومه از ورودی بازه"
                      : kpi.id === "open"
                        ? "پرونده‌های باز از ورودی بازه"
                        : kpi.label
                  }
                  href={drill?.href}
                  hrefHint={drill?.hint}
                  onClick={() => {
                    if (filters.subjectClassId != null) setSubjectClassId(null);
                  }}
                />
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-[var(--border)] bg-white p-4 text-sm text-[var(--muted)]">
            در حال بارگذاری شاخص‌های پرونده‌ها…
          </div>
        )}
      </section>

      <section aria-labelledby="complaint-kpis-heading" className="space-y-3">
        <h2 id="complaint-kpis-heading" className="text-base font-semibold text-[var(--foreground)]">
          شاخص‌های شکایات · فقط شکایت
        </h2>
        {complaintError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            بارگذاری شاخص‌های شکایات ناموفق بود.
            <pre className="mt-1 whitespace-pre-wrap text-xs">{complaintError}</pre>
          </div>
        ) : complaintData ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            {COMPLAINT_KPIS.map(({ id, label, source }) => {
              const kpi = complaintKpiValues.get(`${source}:${id}`);
              if (!kpi) return null;
              const href = id === "average-days" ? "/resolution" : id === "open" ? "/backlog" : "/demand";
              return (
                <KpiCard
                  key={id}
                  {...kpi}
                  label={label}
                  href={href}
                  secondaryValue={id === "complaint-count" ? null : kpi.secondaryValue}
                  secondaryUnit={id === "complaint-count" ? null : kpi.secondaryUnit}
                  onClick={() => setSubjectClassId(1)}
                />
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-[var(--border)] bg-white p-4 text-sm text-[var(--muted)]">
            در حال بارگذاری شاخص‌های شکایات…
          </div>
        )}
      </section>

      <Panel
        title="شاخص گلوگاه پنهان (HBI)"
        subtitle="نمونه نمایشی — داده ساختگی، بدون اتصال به محاسبات زنده"
      >
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-sm text-slate-600">امتیاز نمونه</div>
              <div className="mt-1 text-4xl font-bold text-orange-700">
                {formatFaNumber(MOCK_HBI_SCORE)}
                <span className="mr-2 text-lg font-medium text-slate-500">از ۱۰۰</span>
              </div>
            </div>
            <span className="rounded-full bg-orange-100 px-3 py-1.5 text-sm font-semibold text-orange-800">
              ریسک بالا · نمونه
            </span>
          </div>
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            {MOCK_HBI_COMPONENTS.map((component) => (
              <div key={component.label}>
                <div className="mb-1 flex justify-between gap-3 text-sm">
                  <span>{component.label}</span>
                  <span className="font-semibold tabular-nums">{formatFaNumber(component.value)}٪</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-orange-500"
                    style={{ width: `${component.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
            این اعداد فقط برای نمایش رابط کاربری ساختگی هستند؛ شاخص HBI واقعی محاسبه نشده و این نمونه مبنای تصمیم‌گیری نیست.
          </p>
        </div>
      </Panel>

      <Panel title="روند ورود و خاتمه" subtitle="ستون ورودی · خط خاتمه · خط‌چین خالص تغییر بار">
        <div className="mb-2 text-left">
          <Link href="/demand" prefetch className="text-xs font-medium text-blue-700 hover:underline">
            مشاهده در تحلیل تقاضا ←
          </Link>
        </div>
        <EChart
          option={throughputOption}
          height={320}
          onEvents={{
            click: () => {
              router.push("/demand");
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
                      <Link href="/critical" prefetch className="grid grid-cols-6 gap-2 text-slate-800">
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
                      </Link>
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
                  router.push("/provinces");
                }
              },
            }}
          />
          <ul className="mt-3 space-y-1 text-sm">
            {data.topAttentionProvinces.map((p) => (
              <li key={p.name}>
                <Link
                  href="/provinces"
                  prefetch
                  onClick={() => applyProvince(p.name)}
                  className="flex w-full justify-between border-b border-slate-50 py-1 text-right hover:bg-blue-50"
                >
                  <span>{p.name}</span>
                  <span className="font-semibold tabular-nums">{formatFaNumber(p.value)}</span>
                </Link>
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
                  <Link
                    href={href}
                    prefetch
                    className="block w-full rounded-md border border-[var(--border)] bg-slate-50 p-3 text-right text-sm transition hover:border-blue-300 hover:bg-blue-50"
                  >
                    <div className="font-semibold text-slate-900">۱. {a.change}</div>
                    <div className="mt-1 text-[12px] text-slate-600">۲. محل: {a.where}</div>
                    <div className="mt-1 text-[12px] text-slate-600">۳. اثر: {a.impact}</div>
                    <div className="mt-1 text-[12px] text-blue-800">۴. پیشنهاد بررسی: {a.suggestedReview}</div>
                  </Link>
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
                  <Link
                    href={href}
                    prefetch
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
                  </Link>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
