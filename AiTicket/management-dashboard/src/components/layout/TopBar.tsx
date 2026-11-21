"use client";

import { useEffect, useState } from "react";
import { Download, RotateCcw } from "lucide-react";
import { usePathname } from "next/navigation";
import { navigation } from "@/config/navigation";
import { managementApi } from "@/data/api";
import { useFilters } from "@/data/FilterContext";
import { PERIOD_OPTIONS, SUBJECT_CLASS_OPTIONS } from "@/data/filters";

type RegionOption = { id: number; name: string };

export function TopBar({ updatedAt }: { updatedAt?: string }) {
  const pathname = usePathname();
  const nav = navigation.find((n) => n.href === pathname);
  const { filters, setPeriod, setRegionId, setSubjectClassId, setDepartmentId, reset } = useFilters();
  const [regions, setRegions] = useState<RegionOption[]>([]);

  useEffect(() => {
    let alive = true;
    managementApi
      .provinces({ period: "all", regionId: null, subjectClassId: null })
      .then((r) => {
        if (!alive) return;
        setRegions(
          [...r.provinces]
            .map((p) => ({ id: p.id, name: p.name }))
            .sort((a, b) => a.name.localeCompare(b.name, "fa")),
        );
      })
      .catch(() => {
        if (alive) setRegions([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <header className="border-b border-[var(--border)] bg-white px-5 py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold text-[var(--foreground)]">
            {nav?.label ?? "داشبورد مدیریتی دیدبان"}
          </h1>
          <p className="mt-1 text-[13px] text-[var(--muted)]">
            پایش درخواست‌ها، شکایات و عملکرد رسیدگی
            {updatedAt ? ` · آخرین به‌روزرسانی: ${new Date(updatedAt).toLocaleString("fa-IR")}` : ""}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <select
            className="min-w-[9rem] rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm"
            value={filters.period}
            onChange={(e) => setPeriod(e.target.value as typeof filters.period)}
            aria-label="بازه زمانی"
          >
            {PERIOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <select
            className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm"
            value={filters.regionId ?? ""}
            onChange={(e) => setRegionId(e.target.value === "" ? null : Number(e.target.value))}
            aria-label="استان"
          >
            <option value="">همه استان‌ها</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>

          <select
            className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm"
            value={filters.subjectClassId ?? ""}
            onChange={(e) =>
              setSubjectClassId(e.target.value === "" ? null : Number(e.target.value))
            }
            aria-label="نوع موضوع"
          >
            {SUBJECT_CLASS_OPTIONS.map((o) => (
              <option key={String(o.id)} value={o.id ?? ""}>
                {o.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <RotateCcw className="h-4 w-4" />
            بازنشانی
          </button>

          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--brand)] px-3 py-2 text-sm text-white hover:bg-[var(--brand-strong)]"
            onClick={() => window.print()}
          >
            <Download className="h-4 w-4" />
            خروجی
          </button>
        </div>
      </div>

      {(filters.regionId != null ||
        filters.subjectClassId != null ||
        filters.departmentId != null ||
        filters.period !== "ytd") && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[var(--muted)]">فیلترهای فعال:</span>
          {filters.period !== "ytd" ? (
            <button
              type="button"
              onClick={() => setPeriod("ytd")}
              className="rounded bg-slate-100 px-2 py-1 hover:bg-slate-200"
              aria-label="پاک کردن فیلتر بازه زمانی"
            >
              بازه: {PERIOD_OPTIONS.find((o) => o.value === filters.period)?.label} ×
            </button>
          ) : null}
          {filters.regionId != null ? (
            <button
              type="button"
              onClick={() => setRegionId(null)}
              className="rounded bg-blue-50 px-2 py-1 text-blue-800 hover:bg-blue-100"
              aria-label="پاک کردن فیلتر استان"
            >
              استان: {regions.find((r) => r.id === filters.regionId)?.name ?? filters.regionId} ×
            </button>
          ) : null}
          {filters.subjectClassId != null ? (
            <button
              type="button"
              onClick={() => setSubjectClassId(null)}
              className="rounded bg-blue-50 px-2 py-1 text-blue-800 hover:bg-blue-100"
              aria-label="پاک کردن فیلتر نوع موضوع"
            >
              نوع: {SUBJECT_CLASS_OPTIONS.find((o) => o.id === filters.subjectClassId)?.label} ×
            </button>
          ) : null}
          {filters.departmentId != null ? (
            <button
              type="button"
              onClick={() => setDepartmentId(null)}
              className="rounded bg-blue-50 px-2 py-1 text-blue-800 hover:bg-blue-100"
            >
              واحد سازمانی شناسه {filters.departmentId} ×
            </button>
          ) : null}
          <button type="button" onClick={reset} className="text-blue-700 underline">
            پاک کردن همه
          </button>
        </div>
      )}
    </header>
  );
}
