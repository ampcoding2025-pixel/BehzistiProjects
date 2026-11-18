"use client";

import { useEffect, useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { EChart } from "@/components/charts/EChart";
import { KpiCard } from "@/components/ui/KpiCard";
import { Panel } from "@/components/ui/Panel";
import { managementApi, type BacklogData } from "@/data/api";
import { useFilters } from "@/data/FilterContext";
import { formatFaNumber } from "@/lib/utils";

export function BacklogPage() {
  const { filters } = useFilters();
  const [data, setData] = useState<BacklogData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    managementApi
      .backlog(filters)
      .then((r) => alive && setData(r))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : "خطا"));
    return () => {
      alive = false;
    };
  }, [filters]);

  const ageOpt = useMemo<EChartsOption>(() => {
    if (!data) return {};
    return {
      tooltip: { trigger: "axis" },
      xAxis: { type: "category", data: data.ageBuckets.map((b) => b.name) },
      yAxis: { type: "value" },
      series: [{ type: "bar", data: data.ageBuckets.map((b) => b.value), itemStyle: { color: "#c2410c" } }],
    };
  }, [data]);

  const unitOpt = useMemo<EChartsOption>(() => {
    const rows = [...(data?.units ?? [])].sort((a, b) => a.openCount - b.openCount).slice(-12);
    return {
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      grid: { left: 150, right: 40, top: 8, bottom: 24 },
      xAxis: { type: "value" },
      yAxis: { type: "category", data: rows.map((r) => r.name), axisLabel: { width: 140, overflow: "truncate" } },
      series: [{ type: "bar", data: rows.map((r) => r.openCount), itemStyle: { color: "#1d4ed8" }, barWidth: 12 }],
    };
  }, [data]);

  if (error) return <pre className="rounded-lg bg-red-50 p-4 text-xs text-red-900 whitespace-pre-wrap">{error}</pre>;
  if (!data) return <div className="py-20 text-center text-sm text-[var(--muted)]">در حال بارگذاری…</div>;

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-950">
        تعریف موقت باز: نبود FinishTime در تاریخ مرجع. تعریف وضعیتی نیازمند مصوبه است. · {data.meta.periodLabel}
      </div>
      <section className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {data.kpis.map((k) => (
          <KpiCard key={k.id} {...k} />
        ))}
      </section>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="سن پرونده‌های باز">
          <EChart option={ageOpt} height={280} />
        </Panel>
        <Panel title="تمرکز بار کاری واحدها">
          <EChart option={unitOpt} height={320} />
        </Panel>
      </div>
      <Panel title="جدول مدیریتی واحدها">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-right text-sm">
            <thead className="text-[11px] text-[var(--muted)]">
              <tr className="border-b">
                <th className="px-2 py-2">واحد سازمانی</th>
                <th className="px-2 py-2">پرونده باز</th>
                <th className="px-2 py-2">میانگین سن</th>
                <th className="px-2 py-2">بیش از ۹۰ روز</th>
              </tr>
            </thead>
            <tbody>
              {data.units.map((u) => (
                <tr key={u.name} className="border-b border-slate-50">
                  <td className="px-2 py-2">{u.name}</td>
                  <td className="px-2 py-2 tabular-nums">{formatFaNumber(u.openCount)}</td>
                  <td className="px-2 py-2 tabular-nums">
                    {u.medianAgeDays == null ? "—" : `${formatFaNumber(u.medianAgeDays, 1)} روز`}
                  </td>
                  <td className="px-2 py-2 tabular-nums">{formatFaNumber(u.over90)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
