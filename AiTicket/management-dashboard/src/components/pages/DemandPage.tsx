"use client";

import { useEffect, useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { EChart } from "@/components/charts/EChart";
import { Panel } from "@/components/ui/Panel";
import { managementApi, type DemandData } from "@/data/api";
import { useFilters } from "@/data/FilterContext";
import { formatFaNumber, formatFaPercent } from "@/lib/utils";

type MonthRange = { label: string; from: string; to: string };

function monthRange(label: string): MonthRange | null {
  const match = /^(\d{4})\/(\d{2})$/.exec(label);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  const pad = (value: number) => String(value).padStart(2, "0");
  const lastDay = new Date(year, month, 0).getDate();
  return {
    label,
    from: `${year}-${pad(month)}-01`,
    to: `${year}-${pad(month)}-${pad(lastDay)}`,
  };
}

export function DemandPage() {
  const { filters } = useFilters();
  const [data, setData] = useState<DemandData | null>(null);
  const [classData, setClassData] = useState<DemandData | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<MonthRange | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [classError, setClassError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setData(null);
    managementApi
      .demand(filters, selectedMonth ?? undefined)
      .then((response) => {
        if (alive) setData(response);
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
  }, [filters, selectedMonth]);

  useEffect(() => {
    if (selectedClassId == null || !data) {
      setClassData(null);
      setClassError(null);
      return;
    }

    let alive = true;
    setClassData(null);
    setClassError(null);
    managementApi
      .demand({ ...filters, subjectClassId: selectedClassId }, selectedMonth ?? undefined)
      .then((response) => {
        if (alive) setClassData(response);
      })
      .catch((e: unknown) => {
        if (alive) setClassError(e instanceof Error ? e.message : "خطا");
      });
    return () => {
      alive = false;
    };
  }, [data, filters, selectedClassId, selectedMonth]);

  const detailData = selectedClassId == null ? data : classData;
  const topics = useMemo(() => {
    const rows = detailData?.topics ?? [];
    if (!selectedTopic) return rows;
    return rows.filter((topic) => topic.id === selectedTopic || topic.name === selectedTopic);
  }, [detailData, selectedTopic]);

  const trendOpt = useMemo<EChartsOption>(() => {
    if (!data) return {};
    return {
      tooltip: { trigger: "axis" },
      legend: { data: ["ورودی", "خاتمه"], bottom: 0 },
      grid: { left: 48, right: 16, top: 16, bottom: 48 },
      xAxis: {
        type: "category",
        data: data.inflowTrend.map((point) => point.label),
        axisLabel: { rotate: 40, fontSize: 10, triggerEvent: true },
      },
      yAxis: { type: "value" },
      series: [
        {
          name: "ورودی",
          type: "line",
          data: data.inflowTrend.map((point) => point.inflow),
          color: "#1d4ed8",
          symbol: "circle",
          symbolSize: 8,
          cursor: "pointer",
        },
        {
          name: "خاتمه",
          type: "line",
          data: data.inflowTrend.map((point) => point.finished),
          color: "#15803d",
          symbol: "circle",
          symbolSize: 8,
          cursor: "pointer",
        },
      ],
    };
  }, [data]);

  const subjectOpt = useMemo<EChartsOption>(() => {
    const rows = [...(detailData?.topSubjects ?? [])].sort((a, b) => a.value - b.value).slice(-12);
    return {
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      grid: { left: 160, right: 40, top: 8, bottom: 24 },
      xAxis: { type: "value" },
      yAxis: { type: "category", data: rows.map((row) => row.name), axisLabel: { width: 150, overflow: "truncate" } },
      series: [{ type: "bar", data: rows.map((row) => row.value), itemStyle: { color: "#1d4ed8" }, barWidth: 12 }],
    };
  }, [detailData]);

  const classOpt = useMemo<EChartsOption>(() => {
    if (!data) return {};
    return {
      tooltip: { trigger: "item" },
      series: [
        {
          type: "pie",
          radius: ["40%", "65%"],
          selectedMode: "single",
          selectedOffset: 8,
          data: data.byClass.map((item) => ({
            name: item.name,
            value: item.value,
            selected: item.id === selectedClassId,
          })),
          label: { fontSize: 11 },
        },
      ],
    };
  }, [data, selectedClassId]);

  if (error) return <ErrorBox error={error} />;
  if (loading || !data) return <Loading />;

  const activeMonth = selectedMonth;
  const trendClick = (event: unknown) => {
    const point = event as { dataIndex?: number; name?: string; componentType?: string };
    const label = typeof point.dataIndex === "number"
      ? data.inflowTrend[point.dataIndex]?.label
      : point.componentType === "xAxis" ? point.name : undefined;
    if (!label) return;
    const range = monthRange(label);
    if (!range) return;
    setSelectedMonth((current) => current?.label === range.label ? null : range);
    setSelectedClassId(null);
    setSelectedTopic(null);
  };

  return (
    <div className="space-y-5">
      <Panel
        title="روند ورود پرونده‌ها"
        subtitle={activeMonth ? `ماه انتخاب‌شده: ${activeMonth.label} · کلیک روی ماه برای انتخاب یا بازگشت` : `${data.meta.periodLabel} · برای محدودکردن سایر نمودارها روی یک ماه کلیک کنید`}
      >
        <EChart
          option={trendOpt}
          height={300}
          onEvents={{ click: trendClick }}
        />
        {activeMonth ? (
          <button type="button" className="mt-2 text-xs font-medium text-blue-700" onClick={() => setSelectedMonth(null)}>
            پاک کردن فیلتر ماه ({activeMonth.label})
          </button>
        ) : null}
      </Panel>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel
          title="توزیع موضوعی (رتبه‌بندی)"
          subtitle={selectedClassId != null ? `نمایش موضوعات نوع درخواست انتخاب‌شده${activeMonth ? ` در ${activeMonth.label}` : ""}` : activeMonth ? `موضوعات در ${activeMonth.label}` : undefined}
        >
          {selectedClassId != null && !classData && !classError ? (
            <div className="py-16 text-center text-sm text-[var(--muted)]">در حال بارگذاری موضوعات…</div>
          ) : classError ? (
            <ErrorBox error={classError} />
          ) : (
            <EChart option={subjectOpt} height={360} onEvents={{
              click: (event) => {
                const name = (event as { name?: string }).name;
                if (name) setSelectedTopic((current) => current === name ? null : name);
              },
            }} />
          )}
          {selectedTopic ? (
            <button type="button" className="mt-2 text-xs text-blue-700" onClick={() => setSelectedTopic(null)}>
              پاک کردن فیلتر موضوع: {selectedTopic}
            </button>
          ) : (
            <p className="mt-2 text-xs text-[var(--muted)]">برای محدودسازی جدول، روی یک میله کلیک کنید.</p>
          )}
        </Panel>
        <Panel
          title="تحلیل نوع درخواست"
          subtitle={activeMonth ? `ترکیب نوع درخواست در ${activeMonth.label}` : undefined}
        >
          <EChart
            option={classOpt}
            height={320}
            onEvents={{
              click: (event) => {
                const name = (event as { name?: string }).name;
                const selected = data.byClass.find((item) => item.name === name);
                if (!selected) return;
                setSelectedClassId((current) => current === selected.id ? null : selected.id);
                setSelectedTopic(null);
              },
            }}
          />
          {selectedClassId != null ? (
            <button type="button" className="mt-2 text-xs font-medium text-blue-700" onClick={() => setSelectedClassId(null)}>
              پاک کردن فیلتر نوع درخواست
            </button>
          ) : (
            <p className="mt-2 text-xs text-[var(--muted)]">برای دیدن رتبه‌بندی موضوعات همان نوع درخواست، روی یک بخش نمودار کلیک کنید.</p>
          )}
        </Panel>
      </div>
      <Panel title="تحلیل تغییرات موضوعی">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-right text-sm">
            <thead className="text-[11px] text-[var(--muted)]">
              <tr className="border-b">
                <th className="px-2 py-2">موضوع</th>
                <th className="px-2 py-2">تعداد فعلی</th>
                <th className="px-2 py-2">تغییر ٪</th>
                <th className="px-2 py-2">سهم از کل</th>
              </tr>
            </thead>
            <tbody>
              {topics.map((topic) => (
                <tr
                  key={topic.id}
                  className={`cursor-pointer border-b border-slate-50 hover:bg-blue-50 ${
                    selectedTopic === topic.name || selectedTopic === topic.id ? "bg-blue-50" : ""
                  }`}
                  onClick={() => setSelectedTopic((current) => current === topic.name || current === topic.id ? null : topic.name)}
                >
                  <td className="px-2 py-2">{topic.name}</td>
                  <td className="px-2 py-2 tabular-nums">{formatFaNumber(topic.count)}</td>
                  <td className="px-2 py-2 tabular-nums">
                    {topic.deltaPercent == null ? "—" : formatFaPercent(topic.deltaPercent)}
                  </td>
                  <td className="px-2 py-2 tabular-nums">{formatFaPercent(topic.sharePercent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function Loading() {
  return <div className="py-20 text-center text-sm text-[var(--muted)]">در حال بارگذاری…</div>;
}
function ErrorBox({ error }: { error: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
      <pre className="whitespace-pre-wrap text-xs">{error}</pre>
    </div>
  );
}
