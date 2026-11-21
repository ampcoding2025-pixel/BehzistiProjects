"use client";

import { useEffect, useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { EChart } from "@/components/charts/EChart";
import { KpiCard } from "@/components/ui/KpiCard";
import { Panel } from "@/components/ui/Panel";
import { managementApi, type ResolutionData } from "@/data/api";
import { useFilters } from "@/data/FilterContext";

export function ResolutionPage() {
  const { filters } = useFilters();
  const [data, setData] = useState<ResolutionData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    managementApi
      .resolution(filters)
      .then((r) => alive && setData(r))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : "خطا"));
    return () => {
      alive = false;
    };
  }, [filters]);

  const trend = useMemo<EChartsOption>(() => {
    if (!data) return {};
    return {
      tooltip: { trigger: "axis" },
      legend: { data: ["ورودی", "مختومه"], bottom: 0 },
      grid: { left: 48, right: 16, top: 16, bottom: 48 },
      xAxis: { type: "category", data: data.throughputTrend.map((p) => p.label), axisLabel: { rotate: 40, fontSize: 10 } },
      yAxis: { type: "value" },
      series: [
        { name: "ورودی", type: "bar", data: data.throughputTrend.map((p) => p.inflow), color: "#1d4ed8" },
        { name: "مختومه", type: "line", data: data.throughputTrend.map((p) => p.finished), color: "#15803d" },
      ],
    };
  }, [data]);

  const steps = useMemo<EChartsOption>(() => {
    if (!data) return {};
    const rows = [...data.stepsDistribution].sort((a, b) => a.value - b.value);
    return {
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      grid: { left: 120, right: 40, top: 8, bottom: 24 },
      xAxis: { type: "value" },
      yAxis: { type: "category", data: rows.map((r) => r.name) },
      series: [{ type: "bar", data: rows.map((r) => r.value), itemStyle: { color: "#1d4ed8" } }],
    };
  }, [data]);

  if (error) return <pre className="rounded-lg bg-red-50 p-4 text-xs text-red-900 whitespace-pre-wrap">{error}</pre>;
  if (!data) return <div className="py-20 text-center text-sm text-[var(--muted)]">در حال بارگذاری…</div>;

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {data.kpis.map((k) => (
          <KpiCard key={k.id} {...k} />
        ))}
      </section>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="روند مختومه در برابر ورودی">
          <EChart option={trend} height={300} />
        </Panel>
        <Panel title="پیچیدگی گردش کار (توزیع تعداد مراحل)">
          <EChart option={steps} height={300} />
        </Panel>
      </div>
    </div>
  );
}
