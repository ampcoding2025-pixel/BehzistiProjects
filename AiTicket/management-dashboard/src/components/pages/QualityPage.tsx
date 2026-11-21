"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/ui/Panel";
import { managementApi, type QualityData } from "@/data/api";
import { useFilters } from "@/data/FilterContext";
import { formatFaPercent } from "@/lib/utils";

export function QualityPage() {
  const { filters } = useFilters();
  const [data, setData] = useState<QualityData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    managementApi
      .quality(filters)
      .then((r) => alive && setData(r))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : "خطا"));
    return () => {
      alive = false;
    };
  }, [filters]);

  if (error) return <pre className="rounded-lg bg-red-50 p-4 text-xs text-red-900 whitespace-pre-wrap">{error}</pre>;
  if (!data) return <div className="py-20 text-center text-sm text-[var(--muted)]">در حال بارگذاری…</div>;

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {data.metrics.map((m) => (
          <article key={m.id} className="rounded-lg border border-[var(--border)] bg-white p-4">
            <div className="text-[13px] text-slate-600">{m.label}</div>
            <div className="mt-2 text-2xl font-bold">
              {m.fillPercent == null ? "—" : formatFaPercent(m.fillPercent)}
            </div>
            <div className="mt-2 text-[11px]">
              <StatusBadge status={m.status} />
            </div>
            <p className="mt-2 text-[12px] text-[var(--muted)]">{m.note}</p>
          </article>
        ))}
      </section>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="هشدارهای کیفیت">
          <ul className="space-y-3 text-sm">
            {data.qualityAlerts.map((a) => (
              <li key={a.id} className="rounded-md border border-[var(--border)] bg-slate-50 p-3">
                <div className="font-semibold">{a.change}</div>
                <div className="mt-1 text-xs text-slate-600">{a.where} · {a.impact}</div>
                <div className="mt-1 text-xs text-blue-800">{a.suggestedReview}</div>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="تعاریف مهم">
          <ul className="list-disc space-y-2 pr-5 text-sm text-slate-700">
            {data.definitions.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ok: "bg-green-100 text-green-800",
    warn: "bg-amber-100 text-amber-900",
    limited: "bg-orange-100 text-orange-900",
    unavailable: "bg-red-100 text-red-800",
  };
  const label: Record<string, string> = {
    ok: "قابل اتکا",
    warn: "نیازمند توجه",
    limited: "پوشش محدود",
    unavailable: "غیرقابل محاسبه",
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${map[status] ?? "bg-slate-100"}`}>
      {label[status] ?? status}
    </span>
  );
}
