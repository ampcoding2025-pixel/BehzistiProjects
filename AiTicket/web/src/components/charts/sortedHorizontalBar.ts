import type { EChartsOption } from "echarts";
import { formatFaNumber } from "@/lib/utils";

const brand = "#0f766e";
const slate = "#64748b";
const amber = "#d97706";

export type NamedBar = { name: string; value: number };

/**
 * Shared Ch.9 / executive pattern: sorted horizontal bars, optional max highlight.
 * Ascending sort so the largest category sits at the top of the category axis.
 */
export function sortedHorizontalBarOption(
  rows: NamedBar[],
  opts?: {
    labelWidth?: number;
    barWidth?: number;
    highlightMax?: boolean;
    color?: string;
    /** Name of the currently selected cross-filter bar */
    selectedName?: string | null;
  },
): EChartsOption {
  const sorted = [...rows].sort((a, b) => a.value - b.value);
  const labelWidth = opts?.labelWidth ?? 130;
  const highlightMax = opts?.highlightMax !== false;
  const baseColor = opts?.color ?? brand;
  const selectedName = opts?.selectedName ?? null;
  const maxValue = sorted.length ? Math.max(...sorted.map((r) => r.value)) : 0;
  const selectedColor = "#0369a1";

  return {
    textStyle: { fontFamily: "var(--font-vazirmatn), Tahoma, sans-serif" },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      valueFormatter: (v) => formatFaNumber(Number(v)),
    },
    grid: { left: labelWidth + 12, right: 48, top: 8, bottom: 20 },
    xAxis: {
      type: "value",
      min: 0,
      axisLabel: {
        color: slate,
        formatter: (v: number) => formatFaNumber(Number(v)),
      },
      splitLine: { lineStyle: { color: "#eef2f7" } },
    },
    yAxis: {
      type: "category",
      data: sorted.map((r) => r.name),
      axisLabel: { color: slate, width: labelWidth, overflow: "truncate" },
      axisTick: { show: false },
      triggerEvent: true,
    },
    series: [
      {
        id: "sorted-bar",
        type: "bar",
        barWidth: opts?.barWidth ?? 12,
        cursor: "pointer",
        data: sorted.map((r) => {
          const isSelected = selectedName != null && r.name === selectedName;
          const isMax = highlightMax && r.value === maxValue && maxValue > 0;
          return {
            value: r.value,
            itemStyle: {
              color: isSelected ? selectedColor : isMax ? amber : baseColor,
              opacity: selectedName && !isSelected ? 0.45 : 1,
            },
          };
        }),
        label: {
          show: true,
          position: "right",
          color: slate,
          fontSize: 11,
          formatter: (p: { value?: number | number[]; name?: string }) => {
            const v = Array.isArray(p.value) ? Number(p.value[0]) : Number(p.value);
            const isSelected = selectedName != null && p.name === selectedName;
            if (isSelected) return formatFaNumber(v);
            if (!highlightMax || !Number.isFinite(v) || v !== maxValue || maxValue <= 0) {
              return "";
            }
            return formatFaNumber(v);
          },
        },
      },
    ],
  };
}
