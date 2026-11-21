import type { EChartsOption } from "echarts";
import type { WorkloadUser } from "@/data/providers/types";
import { formatFaNumber } from "@/lib/utils";

const slate = "#64748b";
const selectedColor = "#0369a1";
const medianLine = "#64748b";

/**
 * Zones from each user's throughput ratio vs the cohort median.
 * Ratio = Σvolume ÷ Σtime = value / totalHours (open elapsed included) — higher = better.
 * Relative = userRatio ÷ medianRatio.
 */
export const WORKLOAD_ZONES = {
  strong: {
    key: "strong",
    name: "پرکار و سریع",
    hint: "حجم بالا · زمان پایین — عملکرد قوی",
    color: "#059669",
    fill: "rgba(16, 185, 129, 0.14)",
    minRelative: 1.25,
  },
  bottleneck: {
    key: "bottleneck",
    name: "گلوگاه",
    hint: "حجم بالا · زمان بالا — نیاز به کمک",
    color: "#e11d48",
    fill: "rgba(244, 63, 94, 0.12)",
    minRelative: 0.75,
  },
  slow: {
    key: "slow",
    name: "کم‌کار و کند",
    hint: "حجم پایین · زمان بالا — نیاز به بهبود",
    color: "#d97706",
    fill: "rgba(245, 158, 11, 0.14)",
    minRelative: 0,
  },
  light: {
    key: "light",
    name: "ظرفیت آزاد",
    hint: "حجم پایین · زمان پایین — ظرفیت آزاد",
    color: "#0284c7",
    fill: "rgba(14, 165, 233, 0.12)",
    minRelative: 1.0,
  },
} as const;

export type WorkloadZoneKey = keyof typeof WORKLOAD_ZONES;

export const RATIO_ZONE_THRESHOLDS = {
  strong: 1.25,
  light: 1.0,
  bottleneck: 0.75,
} as const;

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

/** Elapsed hours for zoning/plot (includes open via COALESCE Finish→now). */
export function performanceHours(row: WorkloadUser): number | null {
  if (row.avgHours != null && Number.isFinite(row.avgHours) && row.avgHours > 0) {
    return Number(row.avgHours);
  }
  return null;
}

/**
 * Throughput ratio: Σvolume ÷ Σtime spent = value / totalHours.
 * Falls back to value / (value×avgHours) = 1/avgHours when totalHours missing.
 */
export function performanceRate(row: WorkloadUser): number | null {
  if (row.value <= 0) return null;
  if (row.totalHours != null && Number.isFinite(row.totalHours) && row.totalHours > 0) {
    return row.value / Number(row.totalHours);
  }
  const avg = performanceHours(row);
  if (avg == null || avg <= 0) return null;
  // value / (value * avg) == 1/avg == COUNT/SUM when avg is true mean
  return 1 / avg;
}

export function zoneFromRelative(relative: number): WorkloadZoneKey {
  if (relative >= RATIO_ZONE_THRESHOLDS.strong) return "strong";
  if (relative >= RATIO_ZONE_THRESHOLDS.light) return "light";
  if (relative >= RATIO_ZONE_THRESHOLDS.bottleneck) return "bottleneck";
  return "slow";
}

/** @deprecated Use workloadRatioBaseline */
export function workloadMedians(rows: WorkloadUser[]): WorkloadRatioBaseline | null {
  return workloadRatioBaseline(rows);
}

export type WorkloadRatioBaseline = {
  medRate: number;
  medLoad: number;
  medHours: number;
};

export function workloadRatioBaseline(rows: WorkloadUser[]): WorkloadRatioBaseline | null {
  const peers = rows.filter((r) => r.value > 0 && performanceRate(r) != null);
  if (!peers.length) return null;
  const medRate = median(peers.map((r) => performanceRate(r)!));
  const medLoad = median(peers.map((r) => r.value));
  const medHours = median(peers.map((r) => performanceHours(r)!));
  if (medRate == null || medRate <= 0 || medLoad == null || medHours == null) return null;
  return { medRate, medLoad, medHours };
}

export function classifyWorkloadZone(
  row: WorkloadUser,
  baseline: WorkloadRatioBaseline | null,
): WorkloadZoneKey | null {
  const rate = performanceRate(row);
  if (rate == null || !baseline) return null;
  return zoneFromRelative(rate / baseline.medRate);
}

export function relativeRate(
  row: WorkloadUser,
  baseline: WorkloadRatioBaseline | null,
): number | null {
  const rate = performanceRate(row);
  if (rate == null || !baseline) return null;
  return rate / baseline.medRate;
}

/** Cap scatter dots for readability; zone medians still use the full cohort. */
const SCATTER_PLOT_LIMIT = 80;

/**
 * Load (X) vs elapsed hours (Y); color = median-ratio band (open users included).
 * Tables search the full `rows` list; this chart plots a volume-ranked subset.
 */
export function workloadScatterOption(
  rows: WorkloadUser[],
  opts?: { selectedId?: number | null; zoneFilter?: WorkloadZoneKey | "all" },
): EChartsOption {
  const selectedId = opts?.selectedId ?? null;
  const zoneFilter = opts?.zoneFilter ?? "all";
  const points = rows.filter((r) => r.value > 0 && performanceRate(r) != null);

  if (!points.length) return {};

  const baseline = workloadRatioBaseline(rows);
  const eligible =
    zoneFilter === "all"
      ? points
      : points.filter((r) => classifyWorkloadZone(r, baseline) === zoneFilter);

  const ranked = [...eligible].sort((a, b) => b.value - a.value);
  const plotPoints = ranked.slice(0, SCATTER_PLOT_LIMIT);
  if (selectedId != null) {
    const selected = eligible.find((r) => r.id === selectedId);
    if (selected && !plotPoints.some((r) => r.id === selectedId)) {
      plotPoints.push(selected);
    }
  }

  const loads = plotPoints.map((r) => r.value);
  const hoursList = plotPoints.map((r) => performanceHours(r)!);
  const medLoad = baseline?.medLoad ?? median(points.map((r) => r.value)) ?? 0;
  const medHours = baseline?.medHours ?? median(points.map((r) => performanceHours(r)!)) ?? 0;
  const niceMax = (v: number) => {
    if (v <= 0) return 1;
    const padded = v * 1.15;
    const mag = 10 ** Math.floor(Math.log10(padded));
    return Math.ceil(padded / mag) * mag;
  };
  const maxLoad = niceMax(Math.max(...loads, medLoad, 1));
  const maxHours = niceMax(Math.max(...hoursList, medHours, 1));

  const byZone: Record<WorkloadZoneKey, typeof plotPoints> = {
    strong: [],
    light: [],
    bottleneck: [],
    slow: [],
  };

  for (const r of plotPoints) {
    const z = classifyWorkloadZone(r, baseline);
    if (!z) continue;
    byZone[z].push(r);
  }

  const zoneOrder: WorkloadZoneKey[] = ["strong", "bottleneck", "slow", "light"];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const series: any[] = zoneOrder.map((key, index) => {
    const zone = WORKLOAD_ZONES[key];
    const data = byZone[key].map((r) => {
      const selected = selectedId != null && r.id === selectedId;
      const hours = performanceHours(r)!;
      const rate = performanceRate(r)!;
      const rel = baseline ? rate / baseline.medRate : null;
      const openOnly = (r.finishedCount ?? 0) <= 0;
      return {
        name: r.name,
        value: [r.value, hours],
        userId: r.id,
        zone: key,
        zoneLabel: zone.name,
        rate,
        relative: rel,
        openOnly,
        finishedCount: r.finishedCount ?? 0,
        symbolSize: selected ? 18 : 11,
        itemStyle: {
          color: selected ? selectedColor : zone.color,
          opacity: selectedId != null && !selected ? 0.35 : 0.9,
          borderColor: selected ? "#0c4a6e" : openOnly ? "#64748b" : "#fff",
          borderWidth: selected ? 2 : openOnly ? 2 : 1,
          borderType: openOnly ? ("dashed" as const) : ("solid" as const),
        },
      };
    });

    return {
      id: `zone-${key}`,
      name: zone.name,
      type: "scatter" as const,
      cursor: "pointer",
      data,
      z: 3,
      emphasis: {
        scale: 1.25,
        label: {
          show: true,
          formatter: "{b}",
          color: "#0f172a",
          fontSize: 11,
          position: "top" as const,
        },
      },
      ...(index === 0
        ? {
            markLine: {
              silent: true,
              symbol: "none" as const,
              z: 2,
              lineStyle: { type: "dashed" as const, color: medianLine, width: 1.2 },
              label: {
                color: slate,
                fontSize: 10,
                formatter: (p: { value?: number }) =>
                  p.value == null ? "" : formatFaNumber(Math.round(Number(p.value))),
              },
              data: [
                { xAxis: medLoad, name: "میانه حجم" },
                { yAxis: medHours, name: "میانه ساعت" },
              ],
            },
          }
        : {}),
    };
  });

  const medRateLabel =
    baseline != null
      ? `میانه نسبت (Σحجم÷Σساعت): ${formatFaNumber(baseline.medRate, 2)}`
      : "";

  return {
    animation: false,
    textStyle: { fontFamily: "var(--font-vazirmatn), Tahoma, sans-serif" },
    color: zoneOrder.map((k) => WORKLOAD_ZONES[k].color),
    title: baseline
      ? {
          text: medRateLabel,
          left: "center",
          top: 4,
          textStyle: { color: slate, fontSize: 11, fontWeight: 400 },
        }
      : undefined,
    legend: {
      type: "scroll",
      bottom: 4,
      left: "center",
      icon: "roundRect",
      itemWidth: 12,
      itemHeight: 10,
      itemGap: 14,
      textStyle: { color: slate, fontSize: 10 },
      data: zoneOrder.map((k) => ({
        name: WORKLOAD_ZONES[k].name,
        itemStyle: { color: WORKLOAD_ZONES[k].color },
      })),
      formatter: (name: string) => name,
      selectedMode: false,
    },
    tooltip: {
      trigger: "item",
      formatter: (p: unknown) => {
        const item = p as {
          name?: string;
          value?: number[];
          data?: {
            zoneLabel?: string;
            rate?: number | null;
            relative?: number | null;
            openOnly?: boolean;
            finishedCount?: number;
          };
          seriesName?: string;
        };
        const v = item.value ?? [];
        const load = Number(v[0] ?? 0);
        const avg = Number(v[1] ?? 0);
        const zone = item.data?.zoneLabel ?? item.seriesName ?? "";
        const rateTxt =
          item.data?.rate == null ? "—" : formatFaNumber(item.data.rate, 2);
        const relTxt =
          item.data?.relative == null
            ? "—"
            : `${formatFaNumber(item.data.relative, 2)}× میانه`;
        const openNote = item.data?.openOnly
          ? "<br/><i>همه درخواست‌ها باز — ساعت = سپری‌شده تا الان</i>"
          : item.data?.finishedCount != null
            ? `<br/>اتمام‌شده: ${formatFaNumber(item.data.finishedCount)}`
            : "";
        return `${item.name ?? ""}<br/>منطقه: <b>${zone}</b><br/>نسبت (Σحجم÷Σساعت): ${rateTxt}<br/>نسبت به میانه: ${relTxt}<br/>حجم: ${formatFaNumber(Math.round(load))}<br/>میانگین ساعت: ${formatFaNumber(avg, 1)}${openNote}`;
      },
    },
    grid: { left: 64, right: 36, top: 36, bottom: 72 },
    xAxis: {
      type: "value",
      name: "حجم کار",
      nameLocation: "middle",
      nameGap: 36,
      nameTextStyle: { color: slate, fontSize: 11 },
      axisLabel: {
        color: slate,
        fontSize: 10,
        margin: 12,
        formatter: (v: number) => formatFaNumber(Math.round(Number(v))),
      },
      splitNumber: 5,
      splitLine: { lineStyle: { color: "#eef2f7" } },
      min: 0,
      max: maxLoad,
    },
    yAxis: {
      type: "value",
      name: "میانگین ساعت (با باز)",
      nameLocation: "middle",
      nameGap: 48,
      nameTextStyle: { color: slate, fontSize: 11 },
      axisLabel: {
        color: slate,
        fontSize: 10,
        margin: 12,
        formatter: (v: number) => formatFaNumber(Math.round(Number(v))),
      },
      splitNumber: 5,
      splitLine: { lineStyle: { color: "#eef2f7" } },
      min: 0,
      max: maxHours,
    },
    series,
  };
}
