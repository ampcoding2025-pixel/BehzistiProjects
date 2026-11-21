"use client";

import { useEffect, useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { EChart } from "@/components/charts/EChart";
import { sortedHorizontalBarOption } from "@/components/charts/sortedHorizontalBar";
import { getAnalyticsProvider } from "@/data/providers";
import type { AnalyticsQueryFilters } from "@/data/filters";
import type {
  NamedValue,
  UserWorkDistributionData,
  UserWorkloadRole,
} from "@/data/providers/types";
import { formatFaNumber } from "@/lib/utils";

function stateBarOption(rows: NamedValue[]): EChartsOption {
  if (!rows.length) return {};
  const order = ["باز", "بسته‌شده"];
  const sorted = [...rows].sort(
    (a, b) => order.indexOf(a.name) - order.indexOf(b.name) || b.value - a.value,
  );
  return {
    animation: false,
    textStyle: { fontFamily: "var(--font-vazirmatn), Tahoma, sans-serif" },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      valueFormatter: (v) => formatFaNumber(Number(v)),
    },
    grid: { left: 72, right: 36, top: 12, bottom: 24 },
    xAxis: {
      type: "value",
      min: 0,
      axisLabel: { color: "#64748b", fontSize: 10 },
      splitLine: { lineStyle: { color: "#eef2f7" } },
    },
    yAxis: {
      type: "category",
      data: sorted.map((r) => r.name),
      axisLabel: { color: "#64748b", fontSize: 11 },
      axisTick: { show: false },
    },
    series: [
      {
        id: "user-work-state",
        type: "bar",
        barWidth: 16,
        data: sorted.map((r) => ({
          value: r.value,
          itemStyle: {
            color: r.name === "باز" ? "#d97706" : "#0f766e",
          },
        })),
        label: {
          show: true,
          position: "right",
          color: "#64748b",
          fontSize: 11,
          formatter: (p: { value?: number }) => formatFaNumber(Number(p.value ?? 0)),
        },
      },
    ],
  };
}

function typeLabelForRole(role: UserWorkloadRole): string {
  switch (role) {
    case "callUser":
    case "caseUser":
      return "توزیع طبقه موضوع";
    default:
      return "توزیع وضعیت کار (گام)";
  }
}

export function UserWorkDistributionRow({
  userId,
  userName,
  role,
  filters,
}: {
  userId: number;
  userName: string;
  role: UserWorkloadRole;
  filters: AnalyticsQueryFilters;
}) {
  const [workDist, setWorkDist] = useState<UserWorkDistributionData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getAnalyticsProvider()
      .getUserWorkDistribution(userId, role, filters)
      .then((res) => {
        if (!alive) return;
        setWorkDist(res);
      })
      .catch(() => {
        if (!alive) return;
        setWorkDist(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [userId, role, filters]);

  const stateOption = useMemo(
    () => stateBarOption(workDist?.byState ?? []),
    [workDist],
  );
  const typeOption = useMemo(
    () =>
      workDist?.byType?.length
        ? sortedHorizontalBarOption(
            workDist.byType.map((r) => ({ name: r.name, value: r.value })),
            { labelWidth: 140, barWidth: 11, highlightMax: true },
          )
        : {},
    [workDist],
  );

  return (
    <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <ChartCard
        title="باز در برابر بسته‌شده"
        subtitle={`توزیع کار «${userName}» بر اساس وضعیت اتمام`}
      >
        {loading ? (
          <p className="flex h-[220px] items-center justify-center text-sm text-slate-500">
            در حال بارگذاری…
          </p>
        ) : (
          <EChart
            option={stateOption}
            height={220}
            ariaLabel="توزیع باز و بسته‌شده"
            emptyMessage="وضعیت باز/بسته برای این کاربر نیست"
          />
        )}
      </ChartCard>
      <ChartCard
        title={typeLabelForRole(role)}
        subtitle={`انواع کاری که «${userName}» در بازه فعلی رسیدگی کرده`}
      >
        {loading ? (
          <p className="flex h-[220px] items-center justify-center text-sm text-slate-500">
            در حال بارگذاری…
          </p>
        ) : (
          <EChart
            option={typeOption}
            height={220}
            ariaLabel="توزیع انواع کار کاربر"
            emptyMessage="نوع کاری برای این کاربر ثبت نشده"
          />
        )}
      </ChartCard>
    </section>
  );
}
