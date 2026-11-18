"use client";

import { useEffect, useState } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";

export function EChart({
  option,
  height = 280,
  onEvents,
}: {
  option: EChartsOption;
  height?: number;
  onEvents?: Record<string, (params: unknown) => void>;
}) {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return (
    <ReactECharts
      option={{ ...option, animation: reduceMotion ? false : option.animation !== false }}
      style={{ height, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
      lazyUpdate
      onEvents={onEvents}
    />
  );
}
