"use client";

import { useEffect, useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { EChart } from "@/components/charts/EChart";
import { Panel } from "@/components/ui/Panel";
import { managementApi, type ProvincesData } from "@/data/api";
import { useFilters } from "@/data/FilterContext";
import { formatFaNumber, formatFaPercent } from "@/lib/utils";

type MetricKey = "cases" | "complaintShare" | "finishRate" | "openCount" | "medianDays" | "pursuitRate";

const metricLabel: Record<MetricKey, string> = {
  cases: "تعداد پرونده",
  complaintShare: "سهم شکایات",
  finishRate: "نرخ خاتمه",
  openCount: "پرونده باز",
  medianDays: "میانه زمان رسیدگی",
  pursuitRate: "نرخ پیگیری",
};

export function ProvincesPage() {
  const { filters } = useFilters();
  const [data, setData] = useState<ProvincesData | null>(null);
  const [metric, setMetric] = useState<MetricKey>("cases");
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    managementApi
      .provinces(filters)
      .then((r) => alive && setData(r))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : "خطا"));
    return () => {
      alive = false;
    };
  }, [filters]);

  const chart = useMemo<EChartsOption>(() => {
    if (!data) return {};
    const rows = [...data.provinces]
      .map((p) => ({
        name: p.name,
        value:
          metric === "cases"
            ? p.cases
            : metric === "complaintShare"
              ? p.complaintShare
              : metric === "finishRate"
                ? p.finishRate
                : metric === "openCount"
                  ? p.openCount
                  : metric === "medianDays"
                    ? p.medianDays ?? 0
                    : p.pursuitRate,
      }))
      .sort((a, b) => a.value - b.value)
      .slice(-15);
    return {
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      grid: { left: 100, right: 40, top: 8, bottom: 24 },
      xAxis: { type: "value" },
      yAxis: { type: "category", data: rows.map((r) => r.name) },
      series: [{ type: "bar", data: rows.map((r) => r.value), itemStyle: { color: "#1d4ed8" }, barWidth: 12 }],
    };
  }, [data, metric]);

  const selectedRow = data?.provinces.find((p) => p.name === selected) ?? data?.provinces[0];
  const nationalCases = data?.provinces.reduce((s, p) => s + p.cases, 0) ?? 0;
  const nationalComplaint =
    nationalCases === 0
      ? 0
      : (data!.provinces.reduce((s, p) => s + (p.complaintShare * p.cases) / 100, 0) / nationalCases) * 100;

  if (error) return <pre className="rounded-lg bg-red-50 p-4 text-xs text-red-900 whitespace-pre-wrap">{error}</pre>;
  if (!data) return <div className="py-20 text-center text-sm text-[var(--muted)]">در حال بارگذاری…</div>;

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs text-slate-600">
        بدون مخرج جمعیتی معتبر، فقط تعداد و سهم پرونده نمایش داده می‌شود. · {data.meta.periodLabel}
      </div>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(metricLabel) as MetricKey[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMetric(m)}
            className={`rounded-md border px-3 py-1.5 text-xs ${
              metric === m ? "border-blue-600 bg-blue-50 text-blue-800" : "border-slate-200 bg-white"
            }`}
          >
            {metricLabel[m]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title={`مقایسه استانی — ${metricLabel[metric]}`}>
          <EChart
            option={chart}
            height={420}
            onEvents={{
              click: (p) => {
                const name = (p as { name?: string }).name;
                if (name) setSelected(name);
              },
            }}
          />
        </Panel>
        <Panel title={selectedRow ? `استان منتخب: ${selectedRow.name}` : "استان منتخب"}>
          {selectedRow ? (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Stat label="تعداد پرونده" value={formatFaNumber(selectedRow.cases)} />
              <Stat label="سهم شکایات" value={formatFaPercent(selectedRow.complaintShare)} />
              <Stat label="نرخ خاتمه" value={formatFaPercent(selectedRow.finishRate)} />
              <Stat
                label="میانه رسیدگی"
                value={selectedRow.medianDays == null ? "—" : `${formatFaNumber(selectedRow.medianDays, 1)} روز`}
              />
              <Stat label="پرونده باز" value={formatFaNumber(selectedRow.openCount)} />
              <Stat label="نرخ پیگیری" value={formatFaPercent(selectedRow.pursuitRate)} />
              <Stat label="میانگین سهم شکایت کشوری (تقریبی)" value={formatFaPercent(nationalComplaint)} />
            </dl>
          ) : null}
        </Panel>
      </div>
      <Panel title="جدول رتبه‌بندی استان‌ها">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-right text-sm">
            <thead className="text-[11px] text-[var(--muted)]">
              <tr className="border-b">
                <th className="px-2 py-2">استان</th>
                <th className="px-2 py-2">پرونده</th>
                <th className="px-2 py-2">سهم شکایت</th>
                <th className="px-2 py-2">نرخ خاتمه</th>
                <th className="px-2 py-2">میانه روز</th>
                <th className="px-2 py-2">باز</th>
                <th className="px-2 py-2">پیگیری</th>
              </tr>
            </thead>
            <tbody>
              {data.provinces.map((p) => (
                <tr
                  key={p.name}
                  className={`cursor-pointer border-b border-slate-50 hover:bg-slate-50 ${
                    selected === p.name ? "bg-blue-50" : ""
                  }`}
                  onClick={() => setSelected(p.name)}
                >
                  <td className="px-2 py-2">{p.name}</td>
                  <td className="px-2 py-2 tabular-nums">{formatFaNumber(p.cases)}</td>
                  <td className="px-2 py-2 tabular-nums">{formatFaPercent(p.complaintShare)}</td>
                  <td className="px-2 py-2 tabular-nums">{formatFaPercent(p.finishRate)}</td>
                  <td className="px-2 py-2 tabular-nums">
                    {p.medianDays == null ? "—" : formatFaNumber(p.medianDays, 1)}
                  </td>
                  <td className="px-2 py-2 tabular-nums">{formatFaNumber(p.openCount)}</td>
                  <td className="px-2 py-2 tabular-nums">{formatFaPercent(p.pursuitRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <div className="text-[11px] text-[var(--muted)]">{label}</div>
      <div className="mt-1 text-lg font-bold">{value}</div>
    </div>
  );
}
