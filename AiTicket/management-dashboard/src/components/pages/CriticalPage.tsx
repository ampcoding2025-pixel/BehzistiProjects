"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/ui/Panel";
import { managementApi, type CriticalData } from "@/data/api";
import { useFilters } from "@/data/FilterContext";
import { formatFaNumber, formatFaPercent } from "@/lib/utils";

export function CriticalPage() {
  const { filters } = useFilters();
  const [data, setData] = useState<CriticalData | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    managementApi
      .critical(filters)
      .then((r) => {
        if (!alive) return;
        setData(r);
        setActive(r.issues[0]?.id ?? null);
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : "خطا"));
    return () => {
      alive = false;
    };
  }, [filters]);

  if (error) return <pre className="rounded-lg bg-red-50 p-4 text-xs text-red-900 whitespace-pre-wrap">{error}</pre>;
  if (!data) return <div className="py-20 text-center text-sm text-[var(--muted)]">در حال بارگذاری…</div>;

  const issue = data.issues.find((i) => i.id === active) ?? data.issues[0];

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs text-slate-600">
        سامانه هم‌زمانی دو تغییر را علت قطعی معرفی نمی‌کند. برچسب‌ها: واقعیت آماری / ارتباط مشاهده‌شده / فرضیه.
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <div className="xl:col-span-2">
          <Panel title="فهرست مسائل مهم">
            <ul className="space-y-2">
              {data.issues.map((i) => (
                <li key={i.id}>
                  <button
                    type="button"
                    onClick={() => setActive(i.id)}
                    className={`w-full rounded-md border px-3 py-2 text-right text-sm ${
                      active === i.id ? "border-blue-600 bg-blue-50" : "border-transparent hover:bg-slate-50"
                    }`}
                  >
                    <div className="font-semibold">{i.name}</div>
                    <div className="mt-1 text-[11px] text-[var(--muted)]">
                      تغییر {i.deltaPercent == null ? "—" : formatFaPercent(i.deltaPercent)} · حجم{" "}
                      {formatFaNumber(i.count)} · سهم {formatFaPercent(i.sharePercent)}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
        <div className="space-y-4 xl:col-span-3">
          <Panel title={issue ? `ریشه‌یابی: ${issue.name}` : "ریشه‌یابی"}>
            {issue ? (
              <div className="space-y-3 text-sm">
                <div className="rounded-md bg-slate-50 p-3">
                  <div className="text-[11px] text-[var(--muted)]">واقعیت آماری</div>
                  <p className="mt-1">
                    حجم فعلی {formatFaNumber(issue.count)} · سهم {formatFaPercent(issue.sharePercent)} · تغییر نسبت به
                    دوره قبل {issue.deltaPercent == null ? "—" : formatFaPercent(issue.deltaPercent)}
                  </p>
                </div>
                <ol className="list-decimal space-y-2 pr-5 text-slate-700">
                  {data.investigationSteps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              </div>
            ) : null}
          </Panel>
          <Panel title="فرضیه‌ها و محدودیت داده">
            <ul className="space-y-3 text-sm">
              {data.hypotheses.map((h) => (
                <li key={h.id} className="rounded-md border border-amber-200 bg-amber-50 p-3">
                  <div className="text-[10px] font-semibold text-amber-900">فرضیه / ارتباط مشاهده‌شده</div>
                  <div className="mt-1 font-medium">{h.change}</div>
                  <div className="mt-1 text-xs text-slate-600">{h.where} · {h.impact}</div>
                  <div className="mt-1 text-xs text-blue-800">{h.suggestedReview}</div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
