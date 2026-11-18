"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FaDataTable } from "@/components/FaDataTable";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { UiSelect } from "@/components/UiSelect";
import {
  YARANE_DOC_TYPES,
  YARANE_EXTRA_TYPES,
} from "@/lib/wizard/yarane-types";

/**
 * Read-only view of MakeOverSupplyLocationCenterCatagory (سقف/کف).
 * Same rows CalculateMarakezYarane uses — UPDATE is done outside this panel.
 */
export function YaraneThresholdsPanel() {
  const [supplyLocationId, setSupplyLocationId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [cols, setCols] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const options = useMemo(
    () =>
      [...YARANE_DOC_TYPES, ...YARANE_EXTRA_TYPES].map((t) => ({
        value: String(t.supplyLocationId),
        label: `${t.shortFa} (#${t.supplyLocationId})`,
        title: t.titleFa,
      })),
    [],
  );

  const load = useCallback(async (sid: string, pageNum = 1) => {
    const id = Number(sid);
    if (!Number.isFinite(id) || id <= 0) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/wizard/yarane", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "thresholds",
          supplyLocationId: id,
          page: pageNum,
          pageSize: 25,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setError(data?.message || "خواندن مبالغ ناموفق بود");
        setRows([]);
        setCols([]);
        setTotal(0);
        return;
      }
      const r = data.result || {};
      setRows(r.rows || []);
      setCols(r.columns || []);
      setPage(Number(r.page || pageNum));
      setTotalPages(Number(r.totalPages || 1));
      setTotal(Number(r.total || 0));
      setMsg(r.message || null);
    } catch {
      setError("خطای شبکه");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (supplyLocationId) void load(supplyLocationId, 1);
  }, [supplyLocationId, load]);

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="panel p-5 space-y-4">
        <p className="text-sm text-[var(--ink-soft)] leading-7">
          جدول سقف و کف یارانه به‌ازای محل تأمین (
          <span dir="ltr">MakeOverSupplyLocationCenterCatagory</span>
          ). محاسبه یارانه همین مقادیر را می‌خواند. این صفحه فقط نمایش است —
          به‌روزرسانی مبالغ در ارمغان / دیتابیس انجام می‌شود.
        </p>

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[16rem] flex-1">
            <UiSelect
              label="محل تأمین اعتبار"
              searchable
              options={options}
              value={supplyLocationId}
              onChange={(v) => {
                setSupplyLocationId(v);
                setPage(1);
              }}
              placeholder="انتخاب نوع یارانه…"
            />
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy || !supplyLocationId}
            onClick={() => void load(supplyLocationId, page)}
          >
            {busy ? <LoadingSpinner size="sm" inline /> : null}
            بروزرسانی
          </button>
        </div>

        {error ? (
          <div className="rounded-xl bg-[#fde8e8] text-[var(--bad)] px-4 py-3 text-sm">
            {error}
          </div>
        ) : null}
        {msg && !error ? (
          <p className="text-xs text-[var(--ink-soft)]">{msg}</p>
        ) : null}

        <FaDataTable
          columns={cols}
          rows={rows}
          empty={
            busy
              ? "…"
              : supplyLocationId
                ? "مبلغی ثبت نشده"
                : "محل تأمین را انتخاب کنید"
          }
          page={page}
          totalPages={totalPages}
          total={total}
          loading={busy}
          onPageChange={(p) => {
            setPage(p);
            void load(supplyLocationId, p);
          }}
        />
      </div>
    </div>
  );
}
