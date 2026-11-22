"use client";

/**
 * Choropleth of Iran provinces (OSM / ODbL boundaries) colored by Didban volume.
 * Click → Inform.RegionId filter via parent callback.
 * GeoJSON: public/geo/iran-provinces.geojson (© OpenStreetMap contributors).
 */
import { useEffect, useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import * as echarts from "echarts";
import { EChart } from "@/components/charts/EChart";
import type { NamedValue } from "@/data/providers/types";
import { canonicalProvinceName, isMappableRegion } from "@/lib/iranRegions";
import { formatFaNumber } from "@/lib/utils";

type GeoFeature = {
  type: string;
  properties: { name?: string; nameEn?: string; [k: string]: unknown };
  geometry: unknown;
};

type GeoCollection = {
  type: string;
  features: GeoFeature[];
};

const MAP_NAME = "iran";

let mapRegisterPromise: Promise<string[]> | null = null;
let cachedProvinceNames: string[] = [];

function ensureIranMapRegistered(): Promise<string[]> {
  const existing = echarts.getMap(MAP_NAME);
  if (existing && cachedProvinceNames.length) {
    return Promise.resolve(cachedProvinceNames);
  }
  if (mapRegisterPromise) return mapRegisterPromise;

  mapRegisterPromise = fetch("/geo/iran-provinces.geojson")
    .then((r) => {
      if (!r.ok) throw new Error("Iran GeoJSON missing");
      return r.json() as Promise<GeoCollection>;
    })
    .then((geo) => {
      const names: string[] = [];
      const cleaned: GeoCollection = {
        type: "FeatureCollection",
        features: geo.features.map((f) => {
          const name = canonicalProvinceName(String(f.properties?.name ?? ""));
          if (name) names.push(name);
          return {
            type: "Feature",
            properties: {
              ...f.properties,
              name,
            },
            geometry: f.geometry,
          };
        }),
      };
      echarts.registerMap(MAP_NAME, cleaned as never);
      cachedProvinceNames = names;
      return names;
    })
    .catch((err) => {
      mapRegisterPromise = null;
      throw err;
    });

  return mapRegisterPromise;
}

export function IranProvinceMap({
  regions,
  selectedName,
  height = 420,
  onSelect,
}: {
  regions: NamedValue[];
  selectedName?: string | null;
  height?: number;
  onSelect?: (region: NamedValue) => void;
}) {
  const [provinceNames, setProvinceNames] = useState<string[]>(cachedProvinceNames);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    ensureIranMapRegistered()
      .then((names) => {
        if (alive) setProvinceNames(names);
      })
      .catch(() => {
        if (alive) setError("بارگذاری نقشه استان‌ها ناموفق بود");
      });
    return () => {
      alive = false;
    };
  }, []);

  const byCanon = useMemo(() => {
    const map = new Map<string, NamedValue>();
    for (const r of regions) {
      if (!isMappableRegion(r.name)) continue;
      map.set(canonicalProvinceName(r.name), r);
    }
    return map;
  }, [regions]);

  const selectedCanon = selectedName ? canonicalProvinceName(selectedName) : null;

  const option = useMemo<EChartsOption>(() => {
    if (!provinceNames.length) return {};

    // Full coverage of every GeoJSON feature avoids ECharts map index bugs
    const data = provinceNames.map((name) => {
      const row = byCanon.get(name);
      const selected = selectedCanon === name;
      return {
        name,
        value: row?.value ?? 0,
        itemStyle: selected
          ? { areaColor: "#0369a1", borderColor: "#0c4a6e", borderWidth: 1.5 }
          : undefined,
      };
    });

    const max = data.reduce((m, r) => Math.max(m, Number(r.value) || 0), 0);

    return {
      animation: false,
      textStyle: { fontFamily: "var(--font-vazirmatn), Tahoma, sans-serif" },
      tooltip: {
        trigger: "item",
        formatter: (p: unknown) => {
          const item = p as { name?: string; value?: number };
          const row = item.name ? byCanon.get(canonicalProvinceName(item.name)) : undefined;
          if (!row) {
            return `${item.name ?? ""}<br/>بدون داده در فیلتر فعلی`;
          }
          return `${item.name}<br/>حجم: ${formatFaNumber(row.value)}`;
        },
      },
      visualMap: {
        min: 0,
        max: Math.max(max, 1),
        left: "left",
        bottom: 12,
        text: ["بیشتر", "کمتر"],
        calculable: false,
        realtime: false,
        inRange: {
          color: ["#ecfdf5", "#5eead4", "#0f766e", "#115e59"],
        },
        textStyle: { color: "#64748b", fontSize: 11 },
      },
      series: [
        {
          id: "iran-provinces",
          name: "استان",
          type: "map",
          map: MAP_NAME,
          roam: true,
          scaleLimit: { min: 0.8, max: 4 },
          // Avoid selectedMode — known to trip getRawIndex during option swaps
          selectedMode: false,
          emphasis: {
            label: { show: true, color: "#0f172a" },
            itemStyle: { areaColor: "#0369a1" },
          },
          itemStyle: {
            borderColor: "#94a3b8",
            borderWidth: 0.6,
            areaColor: "#f1f5f9",
          },
          label: { show: false },
          data,
        },
      ],
    };
  }, [provinceNames, byCanon, selectedCanon]);

  const onEvents = useMemo(
    () => ({
      click: (params: unknown) => {
        try {
          const p = params as { name?: string; componentType?: string };
          if (!p.name || p.componentType === "visualMap") return;
          const key = canonicalProvinceName(p.name);
          const row = byCanon.get(key);
          if (row) onSelect?.(row);
        } catch {
          // Ignore ECharts internal click races
        }
      },
    }),
    [byCanon, onSelect],
  );

  if (error) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-rose-700">{error}</div>
    );
  }

  if (!provinceNames.length) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-[var(--muted)]">
        در حال آماده‌سازی نقشه...
      </div>
    );
  }

  return (
    <EChart
      key={`iran-map-${provinceNames.length}`}
      option={option}
      height={height}
      onEvents={onEvents}
      ariaLabel="نقشه استان‌های ایران"
    />
  );
}
