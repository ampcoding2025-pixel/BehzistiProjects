"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useState } from "react";
import { getDiskType } from "@/lib/catalog";
import type { DiskRequest } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";
import { ARMAGHAN } from "@/lib/armaghan";

const PAGE_SIZE = 8;

interface PagePayload {
  items: DiskRequest[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  q: string;
  counts: {
    ready: number;
    handed_to_finance: number;
    failed_or_running: number;
  };
}

export function RequestTable() {
  const [data, setData] = useState<PagePayload | null>(null);
  const [page, setPage] = useState(1);
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Debounce search → server query
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(qInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [qInput]);

  const load = useCallback(async (p: number, query: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(p),
        pageSize: String(PAGE_SIZE),
      });
      if (query) params.set("q", query);
      const res = await fetch(`/api/requests?${params}`);
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.message || "بارگذاری ناموفق");
        return;
      }
      setData(json);
      setPage(json.page);
    } catch {
      setError("خطای شبکه");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(page, q);
  }, [load, page, q]);

  async function rerun(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/requests/${id}/run`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        alert(json.message || "اجرا ناموفق");
        return;
      }
      await load(page, q);
    } finally {
      setBusyId(null);
    }
  }

  const rows = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;

  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-3 gap-3">
        {[
          { k: "آماده / دانلود", v: data?.counts.ready ?? "—" },
          { k: "تحویل به مالی", v: data?.counts.handed_to_finance ?? "—" },
          { k: "خطا / در اجرا", v: data?.counts.failed_or_running ?? "—" },
        ].map((x) => (
          <div key={x.k} className="panel px-4 py-3">
            <div className="text-xs text-[var(--ink-soft)]">{x.k}</div>
            <div className="font-[family-name:var(--font-display)] text-3xl mt-1">{x.v}</div>
          </div>
        ))}
      </div>

      <div className="panel overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--line)] flex flex-wrap gap-2 items-center">
          <div className="field flex-1 min-w-[200px]">
            <label htmlFor="req-search" className="sr-only">
              جستجو
            </label>
            <input
              id="req-search"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="جستجو: کد، عنوان، درخواست‌کننده، وضعیت، شماره ارمغان، مستمری/یارانه…"
              className="w-full"
            />
          </div>
          {qInput ? (
            <button
              type="button"
              className="btn btn-ghost text-xs"
              onClick={() => {
                setQInput("");
                setQ("");
                setPage(1);
              }}
            >
              پاک کردن
            </button>
          ) : null}
        </div>

        <div className="requests-table">
          <table className="data">
            <thead>
              <tr>
                <th className="col-id">کد</th>
                <th className="col-type">نوع / عنوان</th>
                <th className="col-who">درخواست</th>
                <th className="col-status">وضعیت</th>
                <th className="col-tr">ارمغان</th>
                <th className="col-actions">اقدام</th>
              </tr>
            </thead>
            <tbody>
              {loading && !data ? (
                <tr>
                  <td colSpan={6} className="text-center text-[var(--ink-soft)] py-8">
                    در حال بارگذاری…
                  </td>
                </tr>
              ) : null}
              {error ? (
                <tr>
                  <td colSpan={6} className="text-center text-[var(--bad)] py-8">
                    {error}
                  </td>
                </tr>
              ) : null}
              {!loading && !error && rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-[var(--ink-soft)] py-8">
                    {q ? `نتیجه‌ای برای «${q}» نیست` : "درخواستی نیست"}
                  </td>
                </tr>
              ) : null}
              {rows.map((r) => {
                const disk = getDiskType(r.diskTypeId);
                return (
                  <Fragment key={r.id}>
                    <tr>
                      <td className="col-id">
                        <div className="font-mono text-[11px] leading-snug break-all">{r.id}</div>
                      </td>
                      <td className="col-type">
                        <div className="font-semibold leading-snug wrap">
                          {disk?.titleFa ?? r.diskTypeId}
                        </div>
                        <div className="text-xs text-[var(--ink-soft)] wrap mt-0.5">{r.title}</div>
                        <div className="text-[11px] text-[var(--ink-soft)] mt-0.5">
                          {disk?.family === "mostamari" ? "مستمری" : "یارانه"} · {r.periodLabel}
                        </div>
                      </td>
                      <td className="col-who">
                        <div className="wrap text-sm">{r.requestedBy}</div>
                        <div className="font-mono text-[11px] text-[var(--ink-soft)] mt-0.5">
                          {r.requestedAt}
                        </div>
                      </td>
                      <td className="col-status">
                        <StatusBadge status={r.status} />
                        {r.errorMessage ? (
                          <div className="text-[11px] text-[var(--bad)] mt-1 wrap">{r.errorMessage}</div>
                        ) : null}
                        {r.fileName ? (
                          <div className="text-[11px] text-[var(--ink-soft)] mt-1 wrap">{r.fileName}</div>
                        ) : null}
                      </td>
                      <td className="col-tr">
                        {r.armaghanTransactionId ? (
                          <a
                            className="text-[var(--brand)] underline underline-offset-2 text-sm"
                            href={`${ARMAGHAN.uiBase}${ARMAGHAN.transactionsRoute}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            #{r.armaghanTransactionId}
                          </a>
                        ) : (
                          <span className="text-[var(--ink-soft)]">—</span>
                        )}
                      </td>
                      <td className="col-actions">
                        <div className="flex flex-col gap-1 items-stretch">
                          <button
                            type="button"
                            className="btn btn-ghost text-xs !px-2 !py-1"
                            onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                          >
                            لاگ
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary text-xs !px-2 !py-1"
                            disabled={busyId === r.id}
                            onClick={() => rerun(r.id)}
                          >
                            {busyId === r.id ? "…" : "اجرا"}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expanded === r.id ? (
                      <tr>
                        <td colSpan={6} className="bg-[#f7fafb]">
                          <pre className="text-xs whitespace-pre-wrap break-words font-mono text-[var(--ink-soft)] max-h-40 overflow-y-auto p-2">
                            {(r.logTail ?? []).join("\n") || "لاگی نیست"}
                          </pre>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 text-xs text-[var(--ink-soft)] border-t border-[var(--line)] flex flex-wrap items-center justify-between gap-3">
          <span>
            {total} نتیجه{q ? ` برای «${q}»` : ""} · صفحه {data?.page ?? page} از {totalPages}
            {loading ? " · در حال به‌روزرسانی…" : ""}
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              className="btn btn-ghost text-xs"
              disabled={page <= 1 || loading}
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
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              بعدی
            </button>
            <Link href="/request/new" className="text-[var(--brand)] font-semibold ms-2">
              + تراکنش جدید
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
