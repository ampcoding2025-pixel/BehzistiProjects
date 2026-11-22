"use client";

import { useEffect, useState } from "react";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { getAnalyticsProvider } from "@/data/providers";
import type { CookieWorkflowData, CookieWorkflowStep } from "@/data/providers/types";
import { cn, formatFaDate, formatFaNumber } from "@/lib/utils";

function formatHours(hours: number | null | undefined): string | null {
  if (hours == null || Number.isNaN(hours)) return null;
  if (hours <= 0) return "آنی";
  if (hours < 1) return `${formatFaNumber(Math.round(hours * 60), 0)} دقیقه`;
  return `${formatFaNumber(hours, hours >= 10 ? 0 : 1)} ساعت`;
}

function connectorClass(state: CookieWorkflowStep["state"], side: "before" | "after"): string {
  if (state === "skipped") return "bg-slate-200";
  if (state === "remaining") return "bg-orange-200";
  if (side === "before") {
    if (state === "done" || state === "current") return "bg-teal-500";
  } else {
    if (state === "done") return "bg-teal-500";
    if (state === "current") return "bg-orange-200";
  }
  return "bg-slate-200";
}

function StepIcon({
  state,
  order,
}: {
  state: CookieWorkflowStep["state"];
  order: number;
}) {
  return (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums shadow-sm",
        state === "done" && "bg-teal-600 text-white",
        state === "current" && "bg-amber-500 text-white ring-4 ring-amber-100",
        state === "remaining" && "bg-orange-500 text-white ring-2 ring-orange-100",
        state === "skipped" && "bg-slate-300 text-slate-600",
      )}
      title={
        state === "skipped"
          ? `گام ${order} (رد شده)`
          : state === "remaining"
            ? `گام ${order} (باقی‌مانده)`
            : `گام ${order}`
      }
      aria-label={`گام ${formatFaNumber(order)}`}
    >
      {formatFaNumber(order)}
    </span>
  );
}

export function RequestWorkflowStepper({ cookieId }: { cookieId: number }) {
  const [data, setData] = useState<CookieWorkflowData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setData(null);
    getAnalyticsProvider()
      .getCookieWorkflow(cookieId)
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
  }, [cookieId]);

  const lifetimeTxt = formatHours(data?.lifetimeHours);
  const remainingCount = data?.steps.filter((s) => s.state === "remaining").length ?? 0;
  const skippedCount = data?.steps.filter((s) => s.state === "skipped").length ?? 0;
  const subtitle = loading
    ? "در حال بارگذاری مسیر گردش کار…"
    : data
      ? [
          data.subjectClassName,
          data.isOpen ? "باز در سیستم" : "بسته‌شده",
          lifetimeTxt ? `عمر پرونده ${lifetimeTxt}` : null,
          remainingCount > 0 ? `${formatFaNumber(remainingCount)} گام باقی‌مانده` : null,
          skippedCount > 0 ? `${formatFaNumber(skippedCount)} گام ردشده` : null,
          data.pathNote,
        ]
          .filter(Boolean)
          .join(" · ")
      : "مسیر گردش کار در دسترس نیست";

  return (
    <ChartCard
      title={
        data
          ? `مسیر گردش کار · پرونده ${formatFaNumber(data.cookieId)}`
          : `مسیر گردش کار · پرونده ${formatFaNumber(cookieId)}`
      }
      subtitle={subtitle}
    >
      {loading ? (
        <p className="flex h-28 items-center justify-center text-sm text-slate-500">
          در حال ساخت استپر…
        </p>
      ) : !data || data.steps.length === 0 ? (
        <p className="flex h-28 items-center justify-center text-sm text-slate-500">
          گامی برای این درخواست پیدا نشد
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-teal-600" /> گذشته
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> جاری
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-orange-500" /> باقی‌مانده
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-slate-300" /> رد شده
            </span>
            {data.currentStepName ? (
              <span className="ms-auto text-slate-600">
                گام فعلی:{" "}
                <span className="font-medium text-slate-800">{data.currentStepName}</span>
                {data.isOpen ? (
                  <span className="text-slate-500"> (پرونده هنوز بسته نشده)</span>
                ) : null}
              </span>
            ) : null}
          </div>

          <ol className="flex gap-0 overflow-x-auto pb-2 pt-1">
            {data.steps.map((step, idx) => {
              const dwell = formatHours(step.hours);
              const isLast = idx === data.steps.length - 1;
              return (
                <li
                  key={`${step.statusId}-${step.order}`}
                  className="flex min-w-[8rem] flex-1 flex-col items-center"
                >
                  <div className="flex w-full items-center">
                    <div
                      className={cn(
                        "h-0.5 flex-1",
                        idx === 0 ? "bg-transparent" : connectorClass(step.state, "before"),
                      )}
                    />
                    <StepIcon state={step.state} order={step.order} />
                    <div
                      className={cn(
                        "h-0.5 flex-1",
                        isLast ? "bg-transparent" : connectorClass(step.state, "after"),
                      )}
                    />
                  </div>
                  <div className="mt-2.5 px-1 text-center">
                    <div
                      className={cn(
                        "text-xs font-medium leading-snug",
                        step.state === "current" && "text-amber-800",
                        step.state === "done" && "text-slate-800",
                        step.state === "remaining" && "text-orange-700",
                        step.state === "skipped" && "text-slate-400 line-through",
                      )}
                    >
                      {step.name}
                    </div>
                    <div className="mt-0.5 text-[10px] tabular-nums text-slate-500">
                      {step.startTime ? formatFaDate(step.startTime) : "—"}
                    </div>
                    <div className="mt-0.5 text-[10px] tabular-nums text-slate-600">
                      {step.state === "skipped"
                        ? "رد شده"
                        : step.state === "remaining"
                          ? "باقی‌مانده"
                          : dwell
                            ? `ماندگاری ${dwell}`
                            : "بدون زمان خروج"}
                    </div>
                    {step.cumulativeHours != null && (step.state === "done" || step.state === "current") ? (
                      <div className="mt-0.5 text-[10px] font-medium tabular-nums text-slate-700">
                        جمع تا اینجا {formatHours(step.cumulativeHours)}
                        {step.state === "current" && data.isOpen ? " (تا اکنون)" : ""}
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </ChartCard>
  );
}
