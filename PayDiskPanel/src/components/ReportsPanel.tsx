"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReportDef } from "@/lib/reports/catalog";
import { columnTitleFa } from "@/lib/reports/columns-fa";

type RunResult = {
  label: string;
  ms: number;
  columns: string[];
  rows: Record<string, unknown>[];
};

const PAGE_SIZE = 10;

const GROUP_FA = {
  yarane: "یارانه مراکز",
  mostamari: "مستمری / پرداخت به افراد",
  quality: "کیفیت داده",
} as const;

const SEV = {
  info: { label: "اطلاعاتی", bg: "#e8eef3", color: "#3d5166" },
  warn: { label: "هشدار", bg: "#fff1db", color: "#a15c00" },
  critical: { label: "بحرانی", bg: "#fde6e9", color: "#a11f2c" },
} as const;

function cell(v: unknown) {
  if (v == null) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function ReportsPanel() {
  const [reports, setReports] = useState<ReportDef[]>([]);
  const [db, setDb] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [params, setParams] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [note, setNote] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetch("/api/reports")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setReports(d.reports);
          setDb(d.db);
          setSelectedId(d.reports[0]?.id || "");
        }
      })
      .catch(() => setError("بارگذاری فهرست گزارش‌ها ناموفق"));
  }, []);

  const selected = useMemo(
    () => reports.find((r) => r.id === selectedId) || null,
    [reports, selectedId],
  );

  useEffect(() => {
    setParams({});
    setResult(null);
    setError(null);
    setPage(1);
  }, [selectedId]);

  const groups = useMemo(() => {
    const map: Record<keyof typeof GROUP_FA, ReportDef[]> = {
      yarane: [],
      mostamari: [],
      quality: [],
    };
    for (const r of reports) map[r.group].push(r);
    return map;
  }, [reports]);

  const totalPages = useMemo(() => {
    if (!result) return 1;
    return Math.max(1, Math.ceil(result.rows.length / PAGE_SIZE));
  }, [result]);

  const pageRows = useMemo(() => {
    if (!result) return [];
    const start = (page - 1) * PAGE_SIZE;
    return result.rows.slice(start, start + PAGE_SIZE);
  }, [result, page]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  async function run() {
    if (!selected) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setPage(1);
    try {
      const q = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v) q.set(k, v);
      }
      const res = await fetch(`/api/reports/${selected.id}?${q}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.message || "اجرای گزارش ناموفق");
        return;
      }
      setResult(data.result);
      setNote(data.note || "");
      setDb(data.db || db);
    } catch {
      setError("خطای شبکه");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-[280px_1fr] gap-4">
      <div className="panel overflow-hidden">
        <div className="px-3 py-2 border-b border-[var(--line)] text-xs text-[var(--ink-soft)]">
          {db || "…"}
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-2 space-y-3">
          {(Object.keys(GROUP_FA) as Array<keyof typeof GROUP_FA>).map((g) => (
            <div key={g}>
              <div className="text-xs font-semibold text-[var(--ink-soft)] px-2 py-1">
                {GROUP_FA[g]}
              </div>
              <div className="space-y-1">
                {groups[g].map((r) => {
                  const active = r.id === selectedId;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedId(r.id)}
                      className={`w-full text-right rounded-xl px-3 py-2 transition-colors ${
                        active ? "bg-[#e8f6f4] border border-[var(--brand)]/30" : "hover:bg-[var(--paper)]"
                      }`}
                    >
                      <div className="text-sm font-semibold leading-6">{r.title}</div>
                      <div className="text-[11px] text-[var(--ink-soft)] mt-0.5">
                        {SEV[r.severity].label}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4 min-w-0">
        {selected ? (
          <div className="panel p-4 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-xs font-semibold rounded-full px-2 py-1"
                    style={{
                      background: SEV[selected.severity].bg,
                      color: SEV[selected.severity].color,
                    }}
                  >
                    {SEV[selected.severity].label}
                  </span>
                </div>
                <h2 className="font-[family-name:var(--font-display)] text-2xl">{selected.title}</h2>
                <p className="text-sm text-[var(--ink-soft)] mt-2 leading-7">{selected.description}</p>
                <p className="text-sm mt-2 leading-7 border-r-2 border-[var(--brand)] pr-3">
                  <span className="font-semibold">نیاز مدیر: </span>
                  {selected.managerWhy}
                </p>
              </div>
              <button type="button" className="btn btn-primary" disabled={loading} onClick={run}>
                {loading ? "…" : "اجرای گزارش"}
              </button>
            </div>

            {selected.params.length ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {selected.params.map((p) => (
                  <div className="field" key={p.key}>
                    <label htmlFor={p.key}>
                      {p.label}
                      {p.required ? " *" : ""}
                    </label>
                    <input
                      id={p.key}
                      type={p.type === "date" ? "date" : p.type === "number" ? "number" : "text"}
                      placeholder={p.placeholder}
                      value={params[p.key] || ""}
                      onChange={(e) =>
                        setParams((prev) => ({ ...prev, [p.key]: e.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--ink-soft)]">این گزارش پارامتر ندارد.</p>
            )}
          </div>
        ) : null}

        {error ? (
          <div className="panel p-4 text-[var(--bad)] text-sm">{error}</div>
        ) : null}

        {result ? (
          <div className="panel overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--line)] flex flex-wrap justify-between gap-2 text-xs text-[var(--ink-soft)]">
              <span>
                {result.label} · {result.rows.length} ردیف · {result.ms}ms
              </span>
              <span>{note}</span>
            </div>
            <div className="requests-table w-full">
              <table className="data">
                <thead>
                  <tr>
                    {result.columns.map((c) => (
                      <th key={c}>{columnTitleFa(c)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.length === 0 ? (
                    <tr>
                      <td colSpan={Math.max(1, result.columns.length)} className="text-center py-8">
                        موردی یافت نشد
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((row, i) => (
                      <tr key={(page - 1) * PAGE_SIZE + i}>
                        {result.columns.map((c) => (
                          <td key={c} className="wrap text-xs">
                            {cell(row[c])}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 text-xs text-[var(--ink-soft)] border-t border-[var(--line)] flex flex-wrap items-center justify-between gap-3">
              <span>
                {result.rows.length} نتیجه · صفحه {page} از {totalPages}
                {result.rows.length > 0
                  ? ` · نمایش ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, result.rows.length)}`
                  : ""}
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  className="btn btn-ghost text-xs"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  قبلی
                </button>
                <span className="font-mono text-xs px-2">
                  {page}/{totalPages}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost text-xs"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  بعدی
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="panel p-6 text-sm text-[var(--ink-soft)] leading-7">
            یک گزارش را انتخاب کنید
          </div>
        )}
      </div>
    </div>
  );
}
