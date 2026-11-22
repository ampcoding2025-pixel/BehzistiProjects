"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { UserScoreCardPanel } from "@/components/dashboard/UserScoreCard";
import { UserWorkDistributionRow } from "@/components/dashboard/UserWorkDistributionRow";
import { UserRequestsPanel } from "@/components/dashboard/UserRequestsPanel";
import { WorkloadUserTable } from "@/components/dashboard/WorkloadUserTable";
import { EChart } from "@/components/charts/EChart";
import { IranProvinceMap } from "@/components/charts/IranProvinceMap";
import { sortedHorizontalBarOption } from "@/components/charts/sortedHorizontalBar";
import {
  WORKLOAD_ZONES,
  workloadScatterOption,
  type WorkloadZoneKey,
} from "@/components/charts/workloadScatter";
import type { ZoneFilter } from "@/components/dashboard/WorkloadUserTable";
import { getAnalyticsProvider } from "@/data/providers";
import { useDashboardFilters } from "@/data/DashboardFilterContext";
import { filtersKey, hasDimensionFilters } from "@/data/filters";
import type {
  NamedValue,
  RequestAnalyticsData,
  UserWorkloadRole,
  WorkloadUser,
} from "@/data/providers/types";
import { isMappableRegion } from "@/lib/iranRegions";
import {
  buildUserScorecard,
  scoreWorkloadUser,
  type UserScorecardModel,
} from "@/lib/userPerformanceScore";
import {
  cn,
  formatFaDate,
  formatFaMonthLabel,
  formatFaNumber,
  toEnDigits,
} from "@/lib/utils";
import { X } from "lucide-react";

const slate = "#64748b";
const openColor = "#d97706";
const closedColor = "#0f766e";

type ChartClickParams = {
  name?: string;
  seriesName?: string;
  componentType?: string;
  value?: number | number[];
};

function findByName<T extends { name: string }>(
  rows: T[],
  name: string | undefined,
): T | undefined {
  if (!name) return undefined;
  return rows.find((r) => r.name === name);
}

type ScorecardSelection = {
  userId: number;
  role: UserWorkloadRole;
  roleLabel: string;
  /** When true, selection tracks the current best performer automatically */
  followBest: boolean;
};

const ROLE_META: Record<
  UserWorkloadRole,
  { label: string; cohortKey: keyof Pick<
    RequestAnalyticsData,
    "byFlowActor" | "byFlowReferred" | "byCartableUser" | "byCallUser" | "byCaseUser"
  > }
> = {
  flowActor: { label: "اقدام‌کننده روی گام", cohortKey: "byFlowActor" },
  referUser: { label: "ارجاع / بازدید روی گام", cohortKey: "byFlowReferred" },
  cartableUser: { label: "کارتابل", cohortKey: "byCartableUser" },
  callUser: { label: "تماس‌ها", cohortKey: "byCallUser" },
  caseUser: { label: "ثبت پرونده", cohortKey: "byCaseUser" },
};

function pickBestUser(
  cohort: WorkloadUser[],
): WorkloadUser | null {
  // Prefer peers with finished work so open-only volume cannot win "best"
  const withFinished = cohort.filter(
    (r) => r.id != null && r.value > 0 && (r.finishedCount ?? 0) > 0,
  );
  const peers =
    withFinished.length > 0
      ? withFinished
      : cohort.filter((r) => r.id != null && r.value > 0);
  if (!peers.length) return null;
  let best = peers[0]!;
  let bestScore = scoreWorkloadUser(best, peers).score;
  for (let i = 1; i < peers.length; i++) {
    const row = peers[i]!;
    const s = scoreWorkloadUser(row, peers).score;
    if (s > bestScore) {
      best = row;
      bestScore = s;
    }
  }
  return best;
}

function findBestAcrossUserCharts(data: RequestAnalyticsData): ScorecardSelection | null {
  const order: UserWorkloadRole[] = [
    "flowActor",
    "cartableUser",
    "callUser",
    "caseUser",
    "referUser",
  ];
  let winner: { sel: ScorecardSelection; score: number } | null = null;
  for (const role of order) {
    const meta = ROLE_META[role];
    const cohort = data[meta.cohortKey];
    const best = pickBestUser(cohort);
    if (!best || best.id == null) continue;
    const score = scoreWorkloadUser(best, cohort).score;
    if (!winner || score > winner.score) {
      winner = {
        score,
        sel: {
          userId: best.id,
          role,
          roleLabel: meta.label,
          followBest: true,
        },
      };
    }
  }
  return winner?.sel ?? null;
}

export function RequestAnalytics() {
  const {
    filters,
    labels,
    toggleDimension,
    toggleMonth,
    clearMonth,
    setSubjectClassId,
    clearDimensionFilters,
  } = useDashboardFilters();
  const [data, setData] = useState<RequestAnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selection, setSelection] = useState<ScorecardSelection | null>(null);
  const [workloadZoneFilter, setWorkloadZoneFilter] = useState<ZoneFilter>("all");

  const toggleWorkloadZone = (key: WorkloadZoneKey) => {
    setWorkloadZoneFilter((prev) => (prev === key ? "all" : key));
  };


  const selectUser = (
    user: WorkloadUser,
    role: UserWorkloadRole,
    followBest = false,
  ) => {
    if (user.id == null) return;
    setSelection({
      userId: user.id,
      role,
      roleLabel: ROLE_META[role].label,
      followBest,
    });
  };

  const queryKey = filtersKey(filters);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getAnalyticsProvider()
      .getRequestAnalytics(filters)
      .then((res) => {
        if (!alive) return;
        setData(res);
        setSelection((prev) => {
          if (prev && !prev.followBest) {
            const cohort = res[ROLE_META[prev.role].cohortKey];
            const stillThere = cohort.some((u) => u.id === prev.userId);
            if (stillThere) return prev;
          }
          return findBestAcrossUserCharts(res);
        });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
    // refetch whenever any filter dimension changes
    // eslint-disable-next-line react-hooks/exhaustive-deps -- queryKey captures filters
  }, [queryKey]);

  const scorecardView = useMemo(() => {
    if (!data || !selection) return null;
    const cohort = data[ROLE_META[selection.role].cohortKey];
    const user = cohort.find((u) => u.id === selection.userId);
    if (!user) return null;
    const model: UserScorecardModel = buildUserScorecard(
      user,
      cohort,
      selection.roleLabel,
    );
    return { model, cohort, user, role: selection.role, followBest: selection.followBest };
  }, [data, selection]);

  const selectedClassName = labels.subjectClass;
  const selectedRegionName = labels.region;
  const selectedGroupName = labels.subjectGroup;
  const selectedStepName = labels.cookieStatus;
  const selectedFlowActorName =
    scorecardView?.role === "flowActor" ? scorecardView.user.name : labels.flowUser;
  const selectedReferredName =
    scorecardView?.role === "referUser" ? scorecardView.user.name : labels.referUser;

  const classOption = useMemo<EChartsOption>(
    () =>
      data
        ? sortedHorizontalBarOption(
            data.byClass.map((c) => ({ name: c.name, value: c.value })),
            { labelWidth: 110, selectedName: selectedClassName },
          )
        : {},
    [data, selectedClassName],
  );

  const groupOption = useMemo<EChartsOption>(
    () =>
      data
        ? sortedHorizontalBarOption(
            data.bySubjectGroup.map((r) => ({ name: r.name, value: r.value })),
            { labelWidth: 140, selectedName: selectedGroupName },
          )
        : {},
    [data, selectedGroupName],
  );

  const regionOption = useMemo<EChartsOption>(
    () =>
      data
        ? sortedHorizontalBarOption(
            data.byRegion
              .filter((r) => isMappableRegion(r.name))
              .slice(0, 15)
              .map((r) => ({ name: r.name, value: r.value })),
            { labelWidth: 110, selectedName: selectedRegionName },
          )
        : {},
    [data, selectedRegionName],
  );

  const workflowStepOption = useMemo<EChartsOption>(
    () =>
      data
        ? sortedHorizontalBarOption(
            data.byWorkflowStep.map((r) => ({ name: r.name, value: r.value })),
            { labelWidth: 150, selectedName: selectedStepName },
          )
        : {},
    [data, selectedStepName],
  );

  const flowActorOption = useMemo<EChartsOption>(
    () =>
      data
        ? sortedHorizontalBarOption(
            data.byFlowActor.map((r) => ({ name: r.name, value: r.value })),
            { labelWidth: 120, selectedName: selectedFlowActorName },
          )
        : {},
    [data, selectedFlowActorName],
  );

  const flowReferredOption = useMemo<EChartsOption>(
    () =>
      data
        ? sortedHorizontalBarOption(
            data.byFlowReferred.map((r) => ({ name: r.name, value: r.value })),
            { labelWidth: 120, selectedName: selectedReferredName },
          )
        : {},
    [data, selectedReferredName],
  );

  const selectedMonth = labels.month;

  // Full peer set from API (no TOP) — tables search all; scatter uses same for zone medians
  const cartableScatterOption = useMemo(
    () =>
      data
        ? workloadScatterOption(data.byCartableUser, {
            selectedId:
              scorecardView?.role === "cartableUser"
                ? scorecardView.user.id
                : filters.cartableUserId,
            zoneFilter: workloadZoneFilter,
          })
        : {},
    [data, filters.cartableUserId, scorecardView, workloadZoneFilter],
  );

  const callScatterOption = useMemo(
    () =>
      data
        ? workloadScatterOption(data.byCallUser, {
            selectedId:
              scorecardView?.role === "callUser"
                ? scorecardView.user.id
                : filters.callUserId,
            zoneFilter: workloadZoneFilter,
          })
        : {},
    [data, filters.callUserId, scorecardView, workloadZoneFilter],
  );

  const caseScatterOption = useMemo(
    () =>
      data
        ? workloadScatterOption(data.byCaseUser, {
            selectedId:
              scorecardView?.role === "caseUser"
                ? scorecardView.user.id
                : filters.caseUserId,
            zoneFilter: workloadZoneFilter,
          })
        : {},
    [data, filters.caseUserId, scorecardView, workloadZoneFilter],
  );

  const openClosedOption = useMemo<EChartsOption>(() => {
    const trend = data?.openClosedTrend ?? [];
    if (!trend.length) return {};
    const pointStyle = (active: boolean, color: string) => ({
      color,
      borderColor: "#fff",
      borderWidth: 2,
      shadowBlur: active ? 8 : 0,
      shadowColor: color,
    });
    return {
      color: [openColor, closedColor],
      textStyle: { fontFamily: "var(--font-vazirmatn), Tahoma, sans-serif" },
      tooltip: {
        trigger: "axis",
        valueFormatter: (v) => formatFaNumber(Number(v)),
      },
      legend: {
        data: ["درخواست‌ها", "بسته‌شده"],
        bottom: 0,
        textStyle: { color: slate },
      },
      grid: { left: 48, right: 20, top: 28, bottom: 52 },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: trend.map((p) => p.label),
        axisLabel: {
          color: slate,
          rotate: trend.length > 10 ? 35 : 0,
          fontSize: 10,
          formatter: (v: string) => formatFaMonthLabel(String(v)),
        },
        triggerEvent: true,
      },
      yAxis: {
        type: "value",
        axisLabel: {
          color: slate,
          formatter: (v: number) => formatFaNumber(Number(v)),
        },
        splitLine: { lineStyle: { color: "#e2e8f0" } },
      },
      series: [
        {
          id: "requests-line",
          name: "درخواست‌ها",
          type: "line",
          smooth: 0.35,
          showSymbol: true,
          symbol: "circle",
          cursor: "pointer",
          lineStyle: { width: 3, color: openColor },
          emphasis: {
            focus: "series",
            scale: true,
            itemStyle: pointStyle(true, openColor),
          },
          data: trend.map((p) => ({
            value: p.requests,
            symbolSize: selectedMonth === p.label ? 16 : 11,
            itemStyle:
              selectedMonth === p.label
                ? { ...pointStyle(true, openColor), borderColor: "#0c4a6e", borderWidth: 3 }
                : pointStyle(false, openColor),
          })),
        },
        {
          id: "closed-line",
          name: "بسته‌شده",
          type: "line",
          smooth: 0.35,
          showSymbol: true,
          symbol: "circle",
          cursor: "pointer",
          lineStyle: { width: 3, color: closedColor },
          emphasis: {
            focus: "series",
            scale: true,
            itemStyle: pointStyle(true, closedColor),
          },
          data: trend.map((p) => ({
            value: p.closed,
            symbolSize: selectedMonth === p.label ? 16 : 11,
            itemStyle:
              selectedMonth === p.label
                ? { ...pointStyle(true, closedColor), borderColor: "#115e59", borderWidth: 3 }
                : pointStyle(false, closedColor),
          })),
        },
      ],
    };
  }, [data, selectedMonth]);

  const onOpenClosedClick = (params: unknown) => {
    const p = params as ChartClickParams & {
      dataIndex?: number;
      data?: { name?: string } | number;
    };
    // Prefer category axis name / dataIndex — avoids fragile object-data name fields
    const nameEn =
      typeof p.name === "string" ? toEnDigits(p.name).replace("-", "/") : "";
    let label: string | null = /^\d{4}\/\d{2}$/.test(nameEn) ? nameEn : null;
    if (!label && typeof p.dataIndex === "number") {
      label = data?.openClosedTrend?.[p.dataIndex]?.label ?? null;
    }
    if (!label) return;
    // Defer filter update so ECharts finishes the click handler (avoids getRawIndex race)
    startTransition(() => toggleMonth(label));
  };

  const onClassClick = (params: unknown) => {
    const p = params as ChartClickParams;
    const row = findByName(data?.byClass ?? [], p.name);
    if (row?.id == null) return;
    startTransition(() => toggleDimension("subjectClass", row.id, row.name));
  };

  const onGroupClick = (params: unknown) => {
    const p = params as ChartClickParams;
    const row = findByName(data?.bySubjectGroup ?? [], p.name);
    if (row?.id == null) return;
    startTransition(() => toggleDimension("subjectGroup", row.id, row.name));
  };

  const onRegionClick = (params: unknown) => {
    const p = params as ChartClickParams;
    const row = findByName(data?.byRegion ?? [], p.name);
    if (row?.id == null) return;
    startTransition(() => toggleDimension("region", row.id, row.name));
  };

  const onMapRegionSelect = (row: NamedValue) => {
    if (row.id == null) return;
    startTransition(() => toggleDimension("region", row.id, row.name));
  };

  const onChannelClick = (row: NamedValue) => {
    if (row.id == null) return;
    startTransition(() => toggleDimension("channel", row.id, row.name));
  };

  const onWorkflowStepClick = (params: unknown) => {
    const p = params as ChartClickParams;
    const row = findByName(data?.byWorkflowStep ?? [], p.name);
    if (row?.id == null) return;
    startTransition(() => toggleDimension("cookieStatus", row.id, row.name));
  };

  const onFlowActorClick = (params: unknown) => {
    const p = params as ChartClickParams;
    const row = findByName(data?.byFlowActor ?? [], p.name);
    if (!row) return;
    selectUser(row, "flowActor");
  };

  const onFlowReferredClick = (params: unknown) => {
    const p = params as ChartClickParams;
    const row = findByName(data?.byFlowReferred ?? [], p.name);
    if (!row) return;
    selectUser(row, "referUser");
  };

  const onCartableUserClick = (row: WorkloadUser) => {
    selectUser(row, "cartableUser");
  };

  const onCallUserClick = (row: WorkloadUser) => {
    selectUser(row, "callUser");
  };

  const onCaseUserClick = (row: WorkloadUser) => {
    selectUser(row, "caseUser");
  };

  const showBestPerformer = () => {
    if (!data) return;
    const best = findBestAcrossUserCharts(data);
    if (best) setSelection(best);
  };

  const applyScorecardFilter = () => {
    if (!scorecardView?.user.id) return;
    const { user, role } = scorecardView;
    startTransition(() => {
      if (role === "flowActor") toggleDimension("flowUser", user.id, user.name);
      else if (role === "referUser") toggleDimension("referUser", user.id, user.name);
      else if (role === "cartableUser") toggleDimension("cartableUser", user.id, user.name);
      else if (role === "callUser") toggleDimension("callUser", user.id, user.name);
      else toggleDimension("caseUser", user.id, user.name);
    });
  };

  const findWorkloadByScatter = (rows: WorkloadUser[], params: unknown) => {
    const p = params as {
      name?: string;
      data?: { name?: string; userId?: number | null };
    };
    const userId = p.data?.userId;
    if (userId != null) {
      const byId = rows.find((r) => r.id === userId);
      if (byId) return byId;
    }
    const name = p.data?.name ?? p.name;
    return rows.find((r) => r.name === name);
  };

  const onCartableScatterClick = (params: unknown) => {
    const row = findWorkloadByScatter(data?.byCartableUser ?? [], params);
    if (row) onCartableUserClick(row);
  };

  const onCallScatterClick = (params: unknown) => {
    const row = findWorkloadByScatter(data?.byCallUser ?? [], params);
    if (row) onCallUserClick(row);
  };

  const onCaseScatterClick = (params: unknown) => {
    const row = findWorkloadByScatter(data?.byCaseUser ?? [], params);
    if (row) onCaseUserClick(row);
  };

  const onKpiOpen = (id: string) => {
    if (!data) return;
    if (id === "period-total") {
      clearDimensionFilters();
      return;
    }
    if (id === "period-complaints" || id === "complaint-share") {
      const complaint = data.byClass.find((c) => c.id === 1) ?? data.byClass.find((c) => c.name.includes("شکایت"));
      if (complaint?.id != null) {
        toggleDimension("subjectClass", complaint.id, complaint.name);
      } else {
        setSubjectClassId(1, "شکایت");
      }
      return;
    }
    if (id === "guidance-share") {
      const guidance = data.byClass.find((c) => c.name.includes("راهنمایی"));
      if (guidance?.id != null) {
        toggleDimension("subjectClass", guidance.id, guidance.name);
      }
    }
  };

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];
    if (filters.subjectClassId != null) {
      chips.push({
        key: "class",
        label: `طبقه: ${labels.subjectClass ?? formatFaNumber(filters.subjectClassId)}`,
        clear: () => toggleDimension("subjectClass", filters.subjectClassId),
      });
    }
    if (filters.channelId != null) {
      chips.push({
        key: "channel",
        label: `کانال: ${labels.channel ?? formatFaNumber(filters.channelId)}`,
        clear: () => toggleDimension("channel", filters.channelId),
      });
    }
    if (filters.regionId != null) {
      chips.push({
        key: "region",
        label: `استان: ${labels.region ?? formatFaNumber(filters.regionId)}`,
        clear: () => toggleDimension("region", filters.regionId),
      });
    }
    if (filters.subjectGroupId != null) {
      chips.push({
        key: "group",
        label: `گروه: ${labels.subjectGroup ?? formatFaNumber(filters.subjectGroupId)}`,
        clear: () => toggleDimension("subjectGroup", filters.subjectGroupId),
      });
    }
    if (filters.from && filters.to) {
      chips.push({
        key: "month",
        label: `ماه: ${
          labels.month
            ? formatFaMonthLabel(labels.month)
            : `${formatFaDate(filters.from)} → ${formatFaDate(filters.to)}`
        }`,
        clear: () => clearMonth(),
      });
    }
    if (filters.cookieStatusId != null) {
      chips.push({
        key: "step",
        label: `گام: ${labels.cookieStatus ?? formatFaNumber(filters.cookieStatusId)}`,
        clear: () => toggleDimension("cookieStatus", filters.cookieStatusId),
      });
    }
    if (filters.flowUserId != null) {
      chips.push({
        key: "flowUser",
        label: `اقدام‌کننده: ${labels.flowUser ?? formatFaNumber(filters.flowUserId)}`,
        clear: () => toggleDimension("flowUser", filters.flowUserId),
      });
    }
    if (filters.referUserId != null) {
      chips.push({
        key: "referUser",
        label: `ارجاع‌شونده: ${labels.referUser ?? formatFaNumber(filters.referUserId)}`,
        clear: () => toggleDimension("referUser", filters.referUserId),
      });
    }
    if (filters.cartableUserId != null) {
      chips.push({
        key: "cartable",
        label: `کارتابل: ${labels.cartableUser ?? formatFaNumber(filters.cartableUserId)}`,
        clear: () => toggleDimension("cartableUser", filters.cartableUserId),
      });
    }
    if (filters.callUserId != null) {
      chips.push({
        key: "call",
        label: `تماس: ${labels.callUser ?? formatFaNumber(filters.callUserId)}`,
        clear: () => toggleDimension("callUser", filters.callUserId),
      });
    }
    if (filters.caseUserId != null) {
      chips.push({
        key: "case",
        label: `ثبت‌کننده: ${labels.caseUser ?? formatFaNumber(filters.caseUserId)}`,
        clear: () => toggleDimension("caseUser", filters.caseUserId),
      });
    }
    return chips;
  }, [filters, labels, toggleDimension, clearMonth]);

  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-[var(--muted)]">
        در حال بارگذاری تحلیل درخواست‌ها...
      </div>
    );
  }

  return (
    <div className={cn("space-y-5", loading && "opacity-80")}>
      {hasDimensionFilters(filters) ? (
        <div
          className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
          aria-label="فیلترهای متقاطع فعال"
        >
          <span className="text-xs text-slate-500">فیلتر متقاطع:</span>
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.clear}
              className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-1 text-xs font-medium text-sky-900 hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
            >
              {chip.label}
              <X className="h-3 w-3" aria-hidden />
            </button>
          ))}
          <button
            type="button"
            onClick={clearDimensionFilters}
            className="mr-auto text-xs font-medium text-slate-600 underline-offset-2 hover:underline"
          >
            پاک‌کردن همه
          </button>
        </div>
      ) : null}

      <section className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {data.summary.map((kpi) => {
          const selected =
            (kpi.id === "period-complaints" || kpi.id === "complaint-share") &&
            filters.subjectClassId === 1
              ? true
              : Boolean(
                  kpi.id === "guidance-share" &&
                    selectedClassName != null &&
                    selectedClassName.includes("راهنمایی"),
                );
          return (
            <KpiCard key={kpi.id} kpi={kpi} onOpen={onKpiOpen} selected={selected} />
          );
        })}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard
          title="توزیع طبقه درخواست"
          subtitle="کلیک = فیلتر طبقه · مرتب بر اساس حجم فعلی"
        >
          <EChart
            option={classOption}
            height={300}
            onEvents={{ click: onClassClick }}
            emptyMessage="طبقه‌ای برای نمایش نیست"
          />
        </ChartCard>
        <div className="xl:col-span-2">
          <ChartCard
            title="درخواست در برابر بسته‌شده (ماهانه)"
            subtitle="منحنی ماهانه — روی نقطه پررنگ هر ماه کلیک کنید تا همان ماه فیلتر شود"
          >
            <EChart
              option={openClosedOption}
              height={300}
              onEvents={{ click: onOpenClosedClick }}
              emptyMessage="روند ماهانه‌ای در این بازه نیست"
            />
          </ChartCard>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard
          title="نقشه استان‌ها"
          subtitle="رنگ = حجم درخواست"
        >
          <IranProvinceMap
            regions={data.byRegion}
            selectedName={selectedRegionName}
            height={400}
            onSelect={onMapRegionSelect}
          />
        </ChartCard>
        <ChartCard title="توزیع استانی" subtitle="بدون ستاد/نامشخص">
          <EChart
            option={regionOption}
            height={400}
            onEvents={{ click: onRegionClick }}
          />
        </ChartCard>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="گروه‌های موضوعی" subtitle="کلیک = فیلتر گروه موضوعی">
          <EChart
            option={groupOption}
            height={340}
            onEvents={{ click: onGroupClick }}
          />
        </ChartCard>
        <ChartCard title="کانال ثبت">
          <ul className="divide-y divide-slate-100">
            {data.byChannel.map((c) => {
              const selected = filters.channelId != null && c.id === filters.channelId;
              return (
                <li key={`${c.id ?? c.name}`}>
                  <button
                    type="button"
                    onClick={() => onChannelClick(c)}
                    className={cn(
                      "flex w-full items-center justify-between py-3 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]",
                      selected
                        ? "bg-sky-50 px-2 font-medium text-sky-950"
                        : "px-2 text-slate-800 hover:bg-slate-50",
                      filters.channelId != null && !selected && "opacity-50",
                    )}
                  >
                    <span>{c.name}</span>
                    <span className="font-semibold text-slate-900">{formatFaNumber(c.value)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </ChartCard>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard
          title="گام‌های گردش کار"
        >
          <EChart
            option={workflowStepOption}
            height={340}
            onEvents={{ click: onWorkflowStepClick }}
          />
        </ChartCard>
        <ChartCard
          title="اقدام‌کننده روی گام"
        >
          {(data.byFlowActor?.length ?? 0) === 0 ? (
            <p className="flex h-[340px] items-center justify-center px-4 text-center text-sm text-slate-500">
              در این فیلتر اقدامی با شناسه کاربر پیدا نشد
            </p>
          ) : (
            <EChart
              option={flowActorOption}
              height={340}
              onEvents={{ click: onFlowActorClick }}
            />
          )}
        </ChartCard>
        <ChartCard
          title="ارجاع / بازدید روی گام"
        >
          {(data.byFlowReferred?.length ?? 0) === 0 ? (
            <p className="flex h-[340px] items-center justify-center px-4 text-center text-sm text-slate-500">
              در این بازه ارجاع/بازدید گام با کاربر ثبت نشده
            </p>
          ) : (
            <EChart
              option={flowReferredOption}
              height={340}
              onEvents={{ click: onFlowReferredClick }}
            />
          )}
        </ChartCard>
      </section>

      <section className="space-y-8">
        <div className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-900">راهنمای مناطق عملکرد</p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                کلیک روی هر کارت = فیلتر کاربران همان عملکرد
              </p>
            </div>
            {workloadZoneFilter !== "all" ? (
              <button
                type="button"
                onClick={() => setWorkloadZoneFilter("all")}
                className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
              >
                پاک‌کردن فیلتر منطقه
              </button>
            ) : null}
          </div>
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {(
              ["strong", "bottleneck", "slow", "light"] as const
            ).map((key) => {
              const z = WORKLOAD_ZONES[key];
              const active = workloadZoneFilter === key;
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => toggleWorkloadZone(key)}
                    aria-pressed={active}
                    className={cn(
                      "group flex w-full cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 text-right",
                      "transition-all duration-200 ease-out",
                      "hover:-translate-y-0.5 hover:scale-[1.02] hover:shadow-md",
                      "active:translate-y-0 active:scale-[0.99]",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]",
                      active
                        ? "border-slate-400 shadow-sm ring-2 ring-[var(--brand)]/40"
                        : "border-slate-100 hover:border-slate-300",
                      workloadZoneFilter !== "all" && !active && "opacity-55 hover:opacity-100",
                    )}
                    style={{ backgroundColor: z.fill }}
                  >
                    <span
                      className="mt-1 h-3 w-3 shrink-0 rounded-sm transition-transform duration-200 group-hover:scale-125"
                      style={{ backgroundColor: z.color }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-900">{z.name}</span>
                      <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-600">
                        {z.hint}
                      </span>
                      <span className="mt-1.5 block text-[10px] font-medium text-slate-500 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        {active ? "کلیک برای برداشتن فیلتر" : "کلیک برای فیلتر این منطقه"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <ChartCard
            title="کارتابل — پراکندگی بار و زمان"
          >
            {(data.byCartableUser?.filter((r) => r.value > 0).length ?? 0) === 0 ? (
              <p className="flex h-[300px] items-center justify-center px-4 text-center text-sm text-slate-500">
                داده میانگین ساعت برای رسم پراکندگی کافی نیست
              </p>
            ) : (
              <EChart
                option={cartableScatterOption}
                height={360}
                onEvents={{ click: onCartableScatterClick }}
                emptyMessage={
                  workloadZoneFilter !== "all"
                    ? "در این منطقه کاربری برای نمایش نیست"
                    : "داده‌ای برای پراکندگی بار و زمان نیست"
                }
              />
            )}
          </ChartCard>
          <ChartCard
            title="تماس‌ها — پراکندگی بار و زمان"
          >
            {(data.byCallUser?.filter((r) => r.value > 0).length ?? 0) === 0 ? (
              <p className="flex h-[300px] items-center justify-center px-4 text-center text-sm text-slate-500">
                داده میانگین ساعت برای رسم پراکندگی کافی نیست
              </p>
            ) : (
              <EChart
                option={callScatterOption}
                height={360}
                onEvents={{ click: onCallScatterClick }}
                emptyMessage={
                  workloadZoneFilter !== "all"
                    ? "در این منطقه کاربری برای نمایش نیست"
                    : "داده‌ای برای پراکندگی بار و زمان نیست"
                }
              />
            )}
          </ChartCard>
          <ChartCard
            title="ثبت پرونده — پراکندگی بار و زمان"
          >
            {(data.byCaseUser?.filter((r) => r.value > 0).length ?? 0) === 0 ? (
              <p className="flex h-[300px] items-center justify-center px-4 text-center text-sm text-slate-500">
                داده میانگین ساعت برای رسم پراکندگی کافی نیست
              </p>
            ) : (
              <EChart
                option={caseScatterOption}
                height={360}
                onEvents={{ click: onCaseScatterClick }}
                emptyMessage={
                  workloadZoneFilter !== "all"
                    ? "در این منطقه کاربری برای نمایش نیست"
                    : "داده‌ای برای پراکندگی بار و زمان نیست"
                }
              />
            )}
          </ChartCard>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard
          title="کارتابل — عملکرد کاربران"
        >
          <WorkloadUserTable
            rows={data.byCartableUser}
            selectedId={
              scorecardView?.role === "cartableUser"
                ? (scorecardView.user.id ?? null)
                : filters.cartableUserId
            }
            onSelect={onCartableUserClick}
            emptyText="برای این فیلتر ردیف کارتابلی نیست"
            zoneFilter={workloadZoneFilter}
            onZoneFilterChange={setWorkloadZoneFilter}
          />
        </ChartCard>
        <ChartCard
          title="تماس‌ها — عملکرد کاربران"
        >
          <WorkloadUserTable
            rows={data.byCallUser}
            selectedId={
              scorecardView?.role === "callUser"
                ? (scorecardView.user.id ?? null)
                : filters.callUserId
            }
            onSelect={onCallUserClick}
            emptyText="برای این فیلتر تماس ثبت‌شده نیست"
            zoneFilter={workloadZoneFilter}
            onZoneFilterChange={setWorkloadZoneFilter}
          />
        </ChartCard>
        <ChartCard
          title="ثبت پرونده — عملکرد"
        >
          <WorkloadUserTable
            rows={data.byCaseUser}
            selectedId={
              scorecardView?.role === "caseUser"
                ? (scorecardView.user.id ?? null)
                : filters.caseUserId
            }
            onSelect={onCaseUserClick}
            emptyText="برای این فیلتر کاربر ثبت‌کننده نیست"
            zoneFilter={workloadZoneFilter}
            onZoneFilterChange={setWorkloadZoneFilter}
          />
        </ChartCard>
      </section>

      {scorecardView?.user.id != null ? (
        <>
          <UserWorkDistributionRow
            userId={scorecardView.user.id}
            userName={scorecardView.user.name}
            role={scorecardView.role}
            filters={filters}
          />
          <UserRequestsPanel
            userId={scorecardView.user.id}
            userName={scorecardView.user.name}
            role={scorecardView.role}
            filters={filters}
          />
        </>
      ) : null}

      {scorecardView ? (
        <UserScoreCardPanel
          model={scorecardView.model}
          periodLabel={data.meta.periodLabel}
          role={scorecardView.role}
          filters={filters}
          isBestDefault={scorecardView.followBest}
          onShowBest={showBestPerformer}
          onFilter={applyScorecardFilter}
        />
      ) : null}

    </div>
  );
}
