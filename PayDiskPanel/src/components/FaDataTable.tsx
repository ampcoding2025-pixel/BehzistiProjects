"use client";

import { useEffect, useState, type ReactNode } from "react";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { columnTitleFa } from "@/lib/reports/columns-fa";

function fmt(v: unknown) {
  if (v == null || v === "") return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** Build page list with ellipsis: 1 … 4 5 6 … 20 */
function pageWindow(current: number, total: number): Array<number | "…"> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const set = new Set<number>();
  set.add(1);
  set.add(total);
  for (let p = current - 1; p <= current + 1; p++) {
    if (p >= 1 && p <= total) set.add(p);
  }
  if (current <= 3) {
    set.add(2);
    set.add(3);
    set.add(4);
  }
  if (current >= total - 2) {
    set.add(total - 1);
    set.add(total - 2);
    set.add(total - 3);
  }
  const sorted = [...set].sort((a, b) => a - b);
  const out: Array<number | "…"> = [];
  for (let i = 0; i < sorted.length; i++) {
    const n = sorted[i]!;
    if (i > 0 && n - sorted[i - 1]! > 1) out.push("…");
    out.push(n);
  }
  return out;
}

function toFaDigits(n: number | string) {
  return String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]!);
}

function parsePageInput(raw: string) {
  const ascii = raw
    .trim()
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[^\d]/g, "");
  if (!ascii) return NaN;
  return Number(ascii);
}

function TablePager({
  page,
  totalPages,
  total,
  loading,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total?: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
}) {
  const pages = Math.max(1, totalPages);
  const [goto, setGoto] = useState(toFaDigits(page));

  useEffect(() => {
    setGoto(toFaDigits(page));
  }, [page]);

  function goToPage(raw: string | number) {
    const n = typeof raw === "number" ? raw : parsePageInput(String(raw));
    if (!Number.isFinite(n)) {
      setGoto(toFaDigits(page));
      return;
    }
    const next = Math.min(pages, Math.max(1, Math.floor(n)));
    if (next !== page) onPageChange(next);
    setGoto(toFaDigits(next));
  }

  const windowPages = pageWindow(page, pages);

  return (
    <div className="table-pager" dir="ltr">
      <div className="table-pager__side table-pager__side--start" dir="rtl">
        {typeof total === "number" ? (
          <span>{total.toLocaleString("fa-IR")} ردیف</span>
        ) : (
          <span />
        )}
        {loading ? <LoadingSpinner label={null} size="sm" inline /> : null}
      </div>

      <div className="table-pager__center" dir="ltr">
        <button
          type="button"
          className="table-pager__btn"
          disabled={page <= 1 || loading}
          aria-label="صفحه قبل"
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          ‹
        </button>

        <div className="table-pager__nums">
          {windowPages.map((item, i) =>
            item === "…" ? (
              <span key={`e-${i}`} className="table-pager__ellipsis">
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                className={`table-pager__num${item === page ? " is-active" : ""}`}
                disabled={loading || item === page}
                aria-current={item === page ? "page" : undefined}
                onClick={() => onPageChange(item)}
              >
                {toFaDigits(item)}
              </button>
            ),
          )}
        </div>

        <button
          type="button"
          className="table-pager__btn"
          disabled={page >= pages || loading}
          aria-label="صفحه بعد"
          onClick={() => onPageChange(page + 1)}
        >
          ›
        </button>
      </div>

      <div className="table-pager__side table-pager__side--end" dir="rtl">
        <label className="table-pager__goto">
          <span>برو به</span>
          <input
            type="text"
            inputMode="numeric"
            dir="ltr"
            lang="fa"
            value={goto}
            disabled={loading || pages <= 1}
            onChange={(e) => {
              const ascii = e.target.value
                .replace(/[^\d۰-۹٠-٩]/g, "")
                .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
                .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
              setGoto(toFaDigits(ascii));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                goToPage(goto);
              }
            }}
            onBlur={() => goToPage(goto)}
            aria-label="شماره صفحه"
          />
        </label>
      </div>
    </div>
  );
}

export function FaDataTable({
  columns,
  rows,
  empty = "موردی یافت نشد",
  /** @deprecated ignored — tables no longer scroll internally */
  maxHeightClass: _maxHeightClass,
  onRowClick,
  activeRowKey,
  rowKey,
  page,
  totalPages,
  total,
  onPageChange,
  loading,
  columnTitles,
  renderCell,
}: {
  columns: string[];
  rows: Record<string, unknown>[];
  empty?: string;
  maxHeightClass?: string;
  onRowClick?: (row: Record<string, unknown>) => void;
  activeRowKey?: string | number | null;
  rowKey?: (row: Record<string, unknown>, index: number) => string | number;
  /** 1-based page for server-side pagination */
  page?: number;
  totalPages?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  loading?: boolean;
  /** Override header titles (already Persian preferred) */
  columnTitles?: Record<string, string>;
  renderCell?: (
    column: string,
    row: Record<string, unknown>,
    index: number,
  ) => ReactNode | undefined;
}) {
  void _maxHeightClass;
  const cols = columns.length ? columns : ["—"];
  const showPager =
    typeof page === "number" &&
    typeof totalPages === "number" &&
    typeof onPageChange === "function";

  function header(c: string) {
    if (c === "—") return "—";
    return columnTitles?.[c] || columnTitleFa(c);
  }

  const pager = showPager ? (
    <TablePager
      page={page!}
      totalPages={totalPages!}
      total={total}
      loading={loading}
      onPageChange={onPageChange!}
    />
  ) : null;

  return (
    <div className="space-y-2 w-full min-w-0">
      {pager}
      <div
        className={`requests-table w-full border border-[var(--line)] rounded-xl${
          loading && rows.length > 0 ? " opacity-60 pointer-events-none" : ""
        }`}
      >
        <table className="data">
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c}>{header(c)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={cols.length} className="text-center py-8">
                  {loading ? (
                    <LoadingSpinner label="در حال بارگذاری…" size="md" />
                  ) : (
                    empty
                  )}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => {
                const key = rowKey ? rowKey(row, i) : i;
                const active =
                  activeRowKey != null && String(activeRowKey) === String(key);
                return (
                  <tr
                    key={String(key)}
                    className={
                      onRowClick
                        ? `cursor-pointer ${active ? "bg-[#e8f6f4]" : "hover:bg-[var(--paper)]"}`
                        : undefined
                    }
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {cols.map((c) => {
                      const custom = renderCell?.(c, row, i);
                      return (
                        <td key={c} className="wrap text-xs sm:text-sm">
                          {custom !== undefined
                            ? custom
                            : c === "—"
                              ? "—"
                              : fmt(row[c])}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {pager}
    </div>
  );
}
