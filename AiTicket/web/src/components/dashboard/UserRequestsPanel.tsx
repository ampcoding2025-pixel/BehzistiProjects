"use client";

import { useEffect, useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { RequestWorkflowStepper } from "@/components/dashboard/RequestWorkflowStepper";
import { EChart } from "@/components/charts/EChart";
import { sortedHorizontalBarOption } from "@/components/charts/sortedHorizontalBar";
import { getAnalyticsProvider } from "@/data/providers";
import type { AnalyticsQueryFilters } from "@/data/filters";
import type {
  NamedValue,
  UserRequestItem,
  UserRequestsData,
  UserWorkloadRole,
} from "@/data/providers/types";
import { cn, formatFaDate, formatFaNumber } from "@/lib/utils";

const PAGE_SIZE = 10;

type StateFilter = "open" | "closed";

function stepHoursOption(rows: NamedValue[]): EChartsOption {
  if (!rows.length) return {};
  return sortedHorizontalBarOption(
    rows.map((r) => ({ name: r.name, value: r.value })),
    { labelWidth: 140, barWidth: 12, highlightMax: true },
  );
}

function formatLifetimeHours(hours: number | null | undefined): string {
  if (hours == null || Number.isNaN(hours)) return "—";
  if (hours <= 0) return "آنی";
  if (hours < 1) return `${formatFaNumber(Math.round(hours * 60), 0)} دقیقه`;
  return `${formatFaNumber(hours, hours >= 10 ? 0 : 1)} ساعت`;
}

export function UserRequestsPanel({
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
  const [data, setData] = useState<UserRequestsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [stateFilter, setStateFilter] = useState<StateFilter>("open");
  const [page, setPage] = useState(0);
  const [selectedCookieId, setSelectedCookieId] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setPage(0);
    setSelectedCookieId(null);
    getAnalyticsProvider()
      .getUserRequests(userId, role, filters)
      .then((res) => {
        if (!alive) return;
        setData(res);
      })
      .catch(() => {
        if (!alive) return;
        setData(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [userId, role, filters]);

  useEffect(() => {
    setPage(0);
    setSelectedCookieId(null);
  }, [stateFilter]);

  const filteredItems: UserRequestItem[] = useMemo(() => {
    const items = data?.items ?? [];
    return items.filter((i) => (stateFilter === "open" ? i.isOpen : !i.isOpen));
  }, [data, stateFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filteredItems.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  );

  const stepRows = stateFilter === "open" ? (data?.stepHoursOpen ?? []) : (data?.stepHoursClosed ?? []);
  const chartOption = useMemo(() => stepHoursOption(stepRows), [stepRows]);

  const openCount = data?.items.filter((i) => i.isOpen).length ?? 0;
  const closedCount = data?.items.filter((i) => !i.isOpen).length ?? 0;

  return (
    <div className="space-y-4">
      <ChartCard
        title={`درخواست‌های «${userName}»`}
        subtitle={
          loading
            ? "در حال بارگذاری…"
            : `${formatFaNumber(filteredItems.length)} مورد ${stateFilter === "open" ? "باز" : "بسته‌شده"} — برای دیدن مسیر، یک ردیف را انتخاب کنید`
        }
        action={
          <div
            className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5"
            role="group"
            aria-label="فیلتر باز یا بسته"
          >
            <button
              type="button"
              onClick={() => setStateFilter("open")}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition",
                stateFilter === "open"
                  ? "bg-amber-500 text-white shadow-sm"
                  : "text-slate-600 hover:bg-white",
              )}
            >
              باز ({formatFaNumber(openCount)})
            </button>
            <button
              type="button"
              onClick={() => setStateFilter("closed")}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition",
                stateFilter === "closed"
                  ? "bg-teal-700 text-white shadow-sm"
                  : "text-slate-600 hover:bg-white",
              )}
            >
              بسته ({formatFaNumber(closedCount)})
            </button>
          </div>
        }
      >
        {loading ? (
          <p className="flex h-40 items-center justify-center text-sm text-slate-500">
            در حال بارگذاری فهرست درخواست‌ها…
          </p>
        ) : (
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-right text-sm">
                <thead className="text-xs text-slate-500">
                  <tr className="border-b border-slate-100">
                    <th className="py-2 font-medium">شناسه</th>
                    <th className="py-2 font-medium">موضوع</th>
                    <th className="py-2 font-medium">گام</th>
                    <th className="py-2 font-medium">عمر در سیستم</th>
                    <th className="py-2 font-medium">وضعیت</th>
                    <th className="py-2 font-medium">شروع</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-sm text-slate-500">
                        درخواستی در این حالت نیست
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((row) => {
                      const selected = selectedCookieId === row.cookieId;
                      return (
                        <tr
                          key={`${row.cookieId}-${row.stepName}-${row.startTime ?? ""}`}
                          onClick={() => setSelectedCookieId(row.cookieId)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelectedCookieId(row.cookieId);
                            }
                          }}
                          tabIndex={0}
                          role="button"
                          aria-pressed={selected}
                          className={cn(
                            "cursor-pointer border-b border-slate-50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand)]",
                            selected
                              ? "bg-sky-50 font-medium text-sky-950"
                              : "text-slate-800 hover:bg-slate-50",
                            selectedCookieId != null && !selected && "opacity-55",
                          )}
                        >
                          <td className="py-2 tabular-nums text-slate-700">
                            {formatFaNumber(row.cookieId)}
                          </td>
                          <td className="max-w-[220px] truncate py-2" title={row.subject}>
                            {row.subject}
                          </td>
                          <td className="py-2 text-slate-700">{row.stepName}</td>
                          <td className="py-2 tabular-nums">{formatLifetimeHours(row.hours)}</td>
                          <td className="py-2">
                            {row.isOpen ? (
                              <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                                باز
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-800">
                                بسته
                              </span>
                            )}
                          </td>
                          <td className="py-2 text-xs tabular-nums text-slate-600">
                            {row.startTime ? formatFaDate(row.startTime) : "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {filteredItems.length > PAGE_SIZE ? (
              <nav
                className="flex items-center justify-center gap-3"
                aria-label="صفحه‌بندی درخواست‌ها"
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
        )}
      </ChartCard>

      {selectedCookieId != null ? (
        <RequestWorkflowStepper cookieId={selectedCookieId} />
      ) : null}

      <ChartCard
        title={
          stateFilter === "open"
            ? "مجموع ساعت هر گام — درخواست‌های باز"
            : "مجموع ساعت هر گام — درخواست‌های بسته‌شده"
        }
        subtitle={`تجمیع زمان «${userName}» بر اساس گام`}
      >
        {loading ? (
          <p className="flex h-[240px] items-center justify-center text-sm text-slate-500">
            در حال بارگذاری…
          </p>
        ) : (
          <EChart
            option={chartOption}
            height={Math.max(220, Math.min(420, 48 + stepRows.length * 28))}
            ariaLabel="تجمیع ساعت هر گام"
            emptyMessage="برای این حالت دادهٔ گامی نیست"
          />
        )}
      </ChartCard>
    </div>
  );
}
