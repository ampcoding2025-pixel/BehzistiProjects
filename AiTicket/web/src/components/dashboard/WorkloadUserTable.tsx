"use client";

import { useEffect, useMemo, useState } from "react";
import {
  WORKLOAD_ZONES,
  classifyWorkloadZone,
  workloadMedians,
  type WorkloadZoneKey,
} from "@/components/charts/workloadScatter";
import type { WorkloadUser } from "@/data/providers/types";
import { cn, formatFaNumber } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

const PAGE_SIZE = 6;

type SortKey = "name" | "openOnly" | "performance";
export type ZoneFilter = "all" | WorkloadZoneKey;

const ZONE_RANK: Record<WorkloadZoneKey, number> = {
  strong: 4,
  light: 3,
  bottleneck: 2,
  slow: 1,
};

function isOpenOnly(row: WorkloadUser): boolean {
  return (row.finishedCount ?? 0) <= 0;
}

export function WorkloadUserTable({
  rows,
  selectedId,
  onSelect,
  emptyText,
  zoneFilter = "all",
  onZoneFilterChange,
}: {
  rows: WorkloadUser[];
  selectedId: number | null;
  onSelect: (row: WorkloadUser) => void;
  emptyText: string;
  /** Controlled zone filter (from راهنمای مناطق عملکرد) */
  zoneFilter?: ZoneFilter;
  onZoneFilterChange?: (zone: ZoneFilter) => void;
}) {
  const [query, setQuery] = useState("");
  const [localZone, setLocalZone] = useState<ZoneFilter>("all");
  const zone = onZoneFilterChange ? zoneFilter : localZone;
  const setZone = onZoneFilterChange ?? setLocalZone;
  const [sortKey, setSortKey] = useState<SortKey>("performance");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [page, setPage] = useState(0);

  const medians = useMemo(() => workloadMedians(rows), [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = rows.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q)) return false;
      if (zone !== "all") {
        const z = classifyWorkloadZone(r, medians);
        if (z !== zone) return false;
      }
      return true;
    });

    list = [...list].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "name") return dir * a.name.localeCompare(b.name, "fa");
      if (sortKey === "openOnly") {
        const ao = isOpenOnly(a) ? 1 : 0;
        const bo = isOpenOnly(b) ? 1 : 0;
        if (ao !== bo) return dir * (ao - bo);
        return b.value - a.value;
      }
      const za = classifyWorkloadZone(a, medians);
      const zb = classifyWorkloadZone(b, medians);
      const ra = za ? ZONE_RANK[za] : 0;
      const rb = zb ? ZONE_RANK[zb] : 0;
      if (ra !== rb) return dir * (ra - rb);
      return b.value - a.value;
    });
    return list;
  }, [rows, query, zone, sortKey, sortDir, medians]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [query, zone, sortKey, sortDir, rows]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  };

  if (!rows.length) {
    return <p className="py-6 text-center text-sm text-slate-500">{emptyText}</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">جستجوی کاربر</span>
          <Search className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جستجوی نام کاربر…"
            className="w-full rounded-md border border-slate-200 bg-white py-1.5 pr-8 pl-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/30"
          />
        </label>
        <label className="shrink-0 text-sm">
          <span className="sr-only">فیلتر عملکرد</span>
          <select
            value={zone}
            onChange={(e) => setZone(e.target.value as ZoneFilter)}
            className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/30 sm:w-auto"
          >
            <option value="all">همه عملکردها</option>
            {(Object.keys(WORKLOAD_ZONES) as WorkloadZoneKey[]).map((key) => (
              <option key={key} value={key}>
                {WORKLOAD_ZONES[key].name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[320px] text-right text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs text-[var(--muted)]">
              <th className="py-2 font-medium">
                <button type="button" className="hover:text-slate-800" onClick={() => toggleSort("name")}>
                  کاربر {sortKey === "name" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                </button>
              </th>
              <th className="py-2 font-medium">
                <button
                  type="button"
                  className="hover:text-slate-800"
                  onClick={() => toggleSort("openOnly")}
                >
                  همه باز {sortKey === "openOnly" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                </button>
              </th>
              <th className="py-2 font-medium">
                <button
                  type="button"
                  className="hover:text-slate-800"
                  onClick={() => toggleSort("performance")}
                >
                  عملکرد {sortKey === "performance" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-6 text-center text-sm text-slate-500">
                  نتیجه‌ای با این جستجو/فیلتر نیست
                </td>
              </tr>
            ) : (
              pageRows.map((row) => {
                const selected = selectedId != null && row.id === selectedId;
                const z = classifyWorkloadZone(row, medians);
                const zoneMeta = z ? WORKLOAD_ZONES[z] : null;
                const openOnly = isOpenOnly(row);
                return (
                  <tr key={`${row.id ?? row.name}`} className="border-b border-slate-50">
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => onSelect(row)}
                        className={cn(
                          "w-full rounded px-2 py-1 text-right transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]",
                          selected
                            ? "bg-sky-50 font-medium text-sky-950"
                            : "text-slate-800 hover:bg-slate-50",
                          selectedId != null && !selected && "opacity-50",
                        )}
                      >
                        {row.name}
                      </button>
                    </td>
                    <td className="py-2">
                      {openOnly ? (
                        <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                          بله
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">خیر</span>
                      )}
                    </td>
                    <td className="py-2">
                      {zoneMeta ? (
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
                          style={{
                            backgroundColor: zoneMeta.fill,
                            color: zoneMeta.color,
                          }}
                          title={zoneMeta.hint}
                        >
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: zoneMeta.color }}
                          />
                          {zoneMeta.name}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 ? (
        <nav
          className="flex items-center justify-center gap-3"
          aria-label="صفحه‌بندی"
        >
          <button
            type="button"
            disabled={safePage <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            aria-label="صفحه قبل"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <span
            className="min-w-[4.5rem] text-center text-xs font-medium tabular-nums text-slate-700"
            aria-current="page"
          >
            {formatFaNumber(safePage + 1)} / {formatFaNumber(pageCount)}
          </span>
          <button
            type="button"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            aria-label="صفحه بعد"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </nav>
      ) : null}
    </div>
  );
}
