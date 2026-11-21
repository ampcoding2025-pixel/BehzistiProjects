"use client";

import { useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption, SeriesOption } from "echarts";
import { useChartTitle } from "@/components/dashboard/ChartCard";

function seriesList(option: EChartsOption): SeriesOption[] {
  if (!option.series) return [];
  return Array.isArray(option.series) ? option.series : [option.series];
}

function seriesHasData(s: SeriesOption): boolean {
  const data = (s as { data?: unknown }).data;
  if (data == null) return true; // some types (gauge) omit data
  if (Array.isArray(data)) return data.length > 0;
  return true;
}

/** Stable fingerprint so category/series-length swaps remount instead of dispose-while-hover. */
function seriesShapeKey(option: EChartsOption): string {
  return seriesList(option)
    .map((s, i) => {
      const id = (s as { id?: string }).id ?? `s${i}`;
      const type = (s as { type?: string }).type ?? "?";
      const data = (s as { data?: unknown }).data;
      const n = Array.isArray(data) ? data.length : 0;
      return `${id}:${type}:${n}`;
    })
    .join("|");
}

function withStableSeriesIds(option: EChartsOption): EChartsOption {
  const list = seriesList(option);
  if (!list.length) return option;
  return {
    ...option,
    series: list.map((s, i) => {
      const existing = (s as { id?: string }).id;
      if (existing) return s;
      const type = (s as { type?: string }).type ?? "series";
      const name = (s as { name?: string }).name;
      return { ...s, id: name ? `${type}-${name}` : `${type}-${i}` };
    }),
  };
}

export function EChart({
  option,
  height = 280,
  ariaLabel,
  emptyMessage = "داده‌ای برای نمایش نیست",
  onEvents,
}: {
  option: EChartsOption;
  height?: number;
  /** Accessible name; defaults to parent ChartCard title when present */
  ariaLabel?: string;
  /** Shown when series is missing or all series data arrays are empty */
  emptyMessage?: string;
  onEvents?: Record<string, (params: unknown) => void>;
}) {
  const chartTitle = useChartTitle();
  const label = ariaLabel ?? chartTitle ?? "نمودار تحلیلی";
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const list = seriesList(option);
  // some() — multi-series charts may include empty zone series for legend
  const hasRenderableSeries = list.length > 0 && list.some(seriesHasData);

  const merged: EChartsOption = useMemo(
    () =>
      withStableSeriesIds({
        ...option,
        animation: reduceMotion ? false : option.animation !== false,
      }),
    [option, reduceMotion],
  );

  const shapeKey = seriesShapeKey(merged);

  // Skip mounting an empty chart — {} → full option swaps can crash ECharts (getRawIndex)
  if (!hasRenderableSeries) {
    return (
      <div
        role="img"
        aria-label={label}
        className="flex items-center justify-center px-4 text-center text-sm text-[var(--muted)]"
        style={{ height, width: "100%" }}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div role="img" aria-label={label}>
      <ReactECharts
        key={shapeKey}
        option={merged}
        style={{ height, width: "100%" }}
        opts={{ renderer: "canvas" }}
        // notMerge:true disposes series under the cursor → getRawIndex TypeError
        notMerge={false}
        lazyUpdate={false}
        onEvents={onEvents}
      />
    </div>
  );
}
