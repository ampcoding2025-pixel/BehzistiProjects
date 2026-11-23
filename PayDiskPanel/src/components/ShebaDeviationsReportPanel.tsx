"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FaDataTable } from "@/components/FaDataTable";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import {
  EMPTY_SHEBA_REPORT_FILTERS,
  ShebaReportFilterBar,
  ShebaReportToolbar,
  hasShebaReportScope,
  shebaFiltersToParams,
  type ShebaReportFilters,
} from "@/components/ShebaReportFilterBar";

const BASE_COLUMNS = [
  "FirstName",
  "LastName",
  "NID",
  "Center",
  "Province",
  "Account",
  "NationalId",
  "ibn",
  "sayahDeviation",
] as const;

const COLUMN_TITLES: Record<string, string> = {
  TransactionId: "شناسه تراکنش",
  FirstName: "نام",
  LastName: "نام خانوادگی",
  NID: "کد ملی",
  Center: "مرکز",
  Province: "استان",
  Account: "حساب",
  NationalId: "شناسه مرکز",
  ibn: "شبا",
  sayahDeviation: "مغایرت شبا",
};

export function ShebaDeviationsReportPanel() {
  const [filters, setFilters] = useState<ShebaReportFilters>(
    EMPTY_SHEBA_REPORT_FILTERS,
  );
  const [applied, setApplied] = useState<ShebaReportFilters>(
    EMPTY_SHEBA_REPORT_FILTERS,
  );
  const [searched, setSearched] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const [db, setDb] = useState("");
  const [dbEpoch, setDbEpoch] = useState(0);
  const [columns, setColumns] = useState<string[]>([...BASE_COLUMNS]);
  /** Force a fresh Sayah pass when user turns مغایرت شبا switch ON. */
  const refreshSayahRef = useRef(false);

  useEffect(() => {
    const bump = () => setDbEpoch((n) => n + 1);
    const onStorage = (e: StorageEvent) => {
      if (e.key === "paydisk-db-target") bump();
    };
    window.addEventListener("paydisk-db-changed", bump);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("paydisk-db-changed", bump);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    if (!searched) {
      setLoading(false);
      return;
    }

    if (!hasShebaReportScope(applied)) {
      setRows([]);
      setTotal(0);
      setTotalPages(1);
      setMessage(null);
      setError("شناسه تراکنش یا حداقل یک فیلتر (نام، مرکز، استان، …) لازم است");
      setLoading(false);
      return;
    }

    const ac = new AbortController();
    let alive = true;
    const preparingSayah = applied.onlySayahMismatch;
    setLoading(true);
    setError(null);
    setRows([]);
    setMessage(
      preparingSayah
        ? "در حال آماده‌سازی مغایرت شبا از سیاح…"
        : "در حال بارگذاری…",
    );

    const refreshSayah =
      refreshSayahRef.current || (preparingSayah && page === 1);
    refreshSayahRef.current = false;

    (async () => {
      try {
        const params = shebaFiltersToParams(applied, {
          page: String(page),
        });
        if (refreshSayah) params.set("refreshSayah", "1");
        const res = await fetch(`/api/reports/sheba-deviations?${params}`, {
          signal: ac.signal,
        });
        const data = await res.json();
        if (!alive) return;
        if (!res.ok || !data.ok) {
          setError(data.message || "بارگذاری گزارش ناموفق");
          setRows([]);
          setTotal(0);
          setTotalPages(1);
          setMessage(null);
          return;
        }
        const resultCols = Array.isArray(data.result?.columns)
          ? (data.result.columns as string[])
          : [...BASE_COLUMNS];
        setColumns(resultCols);
        setRows(Array.isArray(data.result?.rows) ? data.result.rows : []);
        setTotal(Number(data.result?.total || 0));
        setTotalPages(Number(data.result?.totalPages || 1));
        setMessage(data.result?.message || null);
        setDb(data.dbLabel || data.db || "");
        const returnedPage = Number(data.result?.page || page);
        if (
          Number.isFinite(returnedPage) &&
          returnedPage >= 1 &&
          returnedPage !== page
        ) {
          setPage(returnedPage);
        }
      } catch (err) {
        if (!alive) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("خطای شبکه");
        setMessage(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
      ac.abort();
    };
  }, [applied, page, dbEpoch, searched]);

  function applyFilters(next?: ShebaReportFilters) {
    const f = next || filters;
    if (!hasShebaReportScope(f)) {
      setFilters(f);
      setError("شناسه تراکنش یا حداقل یک فیلتر (نام، کد ملی، مرکز، استان، …) لازم است");
      return;
    }
    const turningSayahOn = f.onlySayahMismatch && !applied.onlySayahMismatch;
    if (turningSayahOn) refreshSayahRef.current = true;
    setFilters(f);
    setApplied(f);
    setSearched(true);
    setPage(1);
  }

  const preparingSayah = loading && applied.onlySayahMismatch;
  const loadLabel = preparingSayah
    ? "در حال آماده‌سازی مغایرت شبا (سیاح)…"
    : "در حال بارگذاری…";

  const tableRows = useMemo(
    () =>
      rows.map((r, i) => ({
        ...r,
        _rowKey: `${page}-${i}-${r.TransactionId || ""}-${r.NID || ""}-${r.ibn || ""}`,
      })),
    [rows, page],
  );

  return (
    <div className="txn-layout">
      <aside className="txn-layout__filters panel p-3 space-y-2">
        <div className="text-sm font-semibold">فیلترها</div>
        {db ? (
          <div className="text-[11px] text-[var(--ink-soft)] leading-5">
            {db}
          </div>
        ) : null}
        <ShebaReportFilterBar
          value={filters}
          onChange={setFilters}
          loading={loading}
          onApply={applyFilters}
        />
        {error ? (
          <div className="rounded-xl bg-[#fde6e9] text-[var(--bad)] px-3 py-2 text-xs">
            {error}
          </div>
        ) : null}
      </aside>

      <div className="txn-layout__table panel overflow-hidden">
        <div className="p-3 border-b border-[var(--line)] space-y-2">
          <ShebaReportToolbar
            value={filters}
            onChange={setFilters}
            loading={loading}
            onApply={applyFilters}
          />
          {message ? (
            <p className="text-[11px] text-[var(--ink-soft)] leading-5 px-0.5">
              {message}
            </p>
          ) : null}
        </div>

        {loading ? (
          <div className="mx-3 sm:mx-4 mt-3 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-4 py-5 flex items-center justify-center gap-3">
            <LoadingSpinner label={loadLabel} size="md" />
          </div>
        ) : null}

        <div className="p-3 sm:p-4">
          <FaDataTable
            columns={columns}
            columnTitles={COLUMN_TITLES}
            rows={tableRows}
            empty={
              !searched
                ? "شناسه تراکنش یا فیلترها را وارد کنید و جستجو / اعمال فیلتر را بزنید"
                : preparingSayah
                  ? loadLabel
                  : "مغایرت شبایی با این فیلترها یافت نشد"
            }
            rowKey={(row) => String(row._rowKey)}
            page={page}
            totalPages={Math.max(1, totalPages)}
            total={total}
            loading={loading}
            onPageChange={setPage}
          />
        </div>
      </div>
    </div>
  );
}
