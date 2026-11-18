"use client";

import { useEffect, useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { EChart } from "@/components/charts/EChart";
import { Panel } from "@/components/ui/Panel";
import { managementApi, type DemandData } from "@/data/api";
import { useFilters } from "@/data/FilterContext";
import { formatFaNumber, formatFaPercent } from "@/lib/utils";

export function DemandPage() {
  const { filters } = useFilters();
  const [data, setData] = useState<DemandData | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    managementApi
      .demand(filters)
      .then((r) => {
        if (alive) setData(r);
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : "خطا"));
    return () => {
      alive = false;
    };
  }, [filters]);

  const topics = useMemo(() => {
    if (!data) return [];
    if (!selected) return data.topics;
    return data.topics.filter((t) => t.id === selected || t.name === selected);
  }, [data, selected]);

  const trendOpt = useMemo<EChartsOption>(() => {
    if (!data) return {};
    return {
      tooltip: { trigger: "axis" },
      legend: { data: ["ورودی", "خاتمه"], bottom: 0 },
      grid: { left: 48, right: 16, top: 16, bottom: 48 },
      xAxis: {
        type: "category",
        data: data.inflowTrend.map((p) => p.label),
        axisLabel: { rotate: 40, fontSize: 10 },
      },
      yAxis: { type: "value" },
      series: [
        { name: "ورودی", type: "line", data: data.inflowTrend.map((p) => p.inflow), color: "#1d4ed8" },
        { name: "خاتمه", type: "line", data: data.inflowTrend.map((p) => p.finished), color: "#15803d" },
      ],
    };
  }, [data]);

  const subjectOpt = useMemo<EChartsOption>(() => {
    const rows = [...(data?.topSubjects ?? [])].sort((a, b) => a.value - b.value).slice(-12);
    return {
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      grid: { left: 160, right: 40, top: 8, bottom: 24 },
      xAxis: { type: "value" },
      yAxis: { type: "category", data: rows.map((r) => r.name), axisLabel: { width: 150, overflow: "truncate" } },
      series: [{ type: "bar", data: rows.map((r) => r.value), itemStyle: { color: "#1d4ed8" }, barWidth: 12 }],
    };
  }, [data]);

  const classOpt = useMemo<EChartsOption>(() => {
    if (!data) return {};
    return {
      tooltip: { trigger: "item" },
      series: [
        {
          type: "pie",
          radius: ["40%", "65%"],
          data: data.byClass.map((c) => ({ name: c.name, value: c.value })),
          label: { fontSize: 11 },
        },
      ],
    };
  }, [data]);

  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;

  return (
    <div className="space-y-5">
      <Panel title="روند ورود پرونده‌ها" subtitle={data.meta.periodLabel}>
        <EChart option={trendOpt} height={300} />
      </Panel>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="توزیع موضوعی (رتبه‌بندی)">
          <EChart
            option={subjectOpt}
            height={360}
            onEvents={{
              click: (p) => {
                const name = (p as { name?: string }).name;
                if (name) setSelected((prev) => (prev === name ? null : name));
              },
            }}
          />
          {selected ? (
            <button type="button" className="mt-2 text-xs text-blue-700" onClick={() => setSelected(null)}>
              پاک کردن فیلتر موضوع: {selected}
            </button>
          ) : (
            <p className="mt-2 text-xs text-[var(--muted)]">برای محدودسازی جدول، روی یک میله کلیک کنید.</p>
          )}
        </Panel>
        <Panel title="تحلیل نوع درخواست">
          <EChart option={classOpt} height={320} />
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
              {topics.map((t) => (
                <tr
                  key={t.id}
                  className={`cursor-pointer border-b border-slate-50 hover:bg-blue-50 ${
                    selected === t.name || selected === t.id ? "bg-blue-50" : ""
                  }`}
                  onClick={() => setSelected((prev) => (prev === t.name || prev === t.id ? null : t.name))}
                >
                  <td className="px-2 py-2">{t.name}</td>
                  <td className="px-2 py-2 tabular-nums">{formatFaNumber(t.count)}</td>
                  <td className="px-2 py-2 tabular-nums">
                    {t.deltaPercent == null ? "—" : formatFaPercent(t.deltaPercent)}
                  </td>
                  <td className="px-2 py-2 tabular-nums">{formatFaPercent(t.sharePercent)}</td>
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
