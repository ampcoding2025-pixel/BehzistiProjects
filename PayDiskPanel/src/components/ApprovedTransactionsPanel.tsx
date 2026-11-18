"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FaDataTable } from "@/components/FaDataTable";
import {
  BankFieldIcon,
  LazyDashCell,
  LazyPayedRowsCell,
  ListFieldIcon,
} from "@/components/LazyDashCell";
import {
  EMPTY_TXN_FILTERS,
  TxnFilterBar,
  TxnTableToolbar,
  txnFiltersToParams,
  type TxnFamilyFilter,
  type TxnFilterValues,
} from "@/components/TxnFilterBar";
import type { ArmaghanTxnListItem } from "@/lib/armaghan/inspect";
import { formatFaDate, formatTxnTitleFa } from "@/lib/format";

function familyFromSearch(raw: string | null): TxnFamilyFilter {
  return raw === "mostamari" ? "mostamari" : "yarane";
}

function filtersForFamily(family: TxnFamilyFilter): TxnFilterValues {
  return {
    ...EMPTY_TXN_FILTERS,
    family,
    status: "approved",
    supplyLocationIds: family === "yarane" ? EMPTY_TXN_FILTERS.supplyLocationIds : [],
    mostamariTypeIds: family === "mostamari" ? EMPTY_TXN_FILTERS.mostamariTypeIds : [],
  };
}

function statusLabelFa(status: TxnFilterValues["status"]) {
  if (status === "draft") return "پیش‌نویس";
  if (status === "approved") return "تاییدشده";
  return "همه";
}

export function ApprovedTransactionsPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlFamily = familyFromSearch(searchParams.get("family"));
  const [filters, setFilters] = useState<TxnFilterValues>(() =>
    filtersForFamily(urlFamily),
  );
  const [applied, setApplied] = useState<TxnFilterValues>(() =>
    filtersForFamily(urlFamily),
  );
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ArmaghanTxnListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [db, setDb] = useState("");
  const [dbEpoch, setDbEpoch] = useState(0);
  const [payedCounts, setPayedCounts] = useState<Record<number, number>>({});
  const [payedLoading, setPayedLoading] = useState<Record<number, boolean>>({});
  /** undefined = not loaded yet; null = loaded empty; string = token/value */
  const [key2Map, setKey2Map] = useState<Record<number, string | null>>({});
  const [key3Map, setKey3Map] = useState<Record<number, string | null>>({});
  const [keysLoading, setKeysLoading] = useState<Record<number, boolean>>({});

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

  // Honor ?family=mostamari after finish redirect (and browser back/forward).
  useEffect(() => {
    setFilters((prev) =>
      prev.family === urlFamily ? prev : filtersForFamily(urlFamily),
    );
    setApplied((prev) => {
      if (prev.family === urlFamily) return prev;
      setPage(1);
      return filtersForFamily(urlFamily);
    });
  }, [urlFamily]);

  useEffect(() => {
    const ac = new AbortController();
    let alive = true;
    setLoading(true);
    setError(null);
    setPayedCounts({});
    setPayedLoading({});
    setKey2Map({});
    setKey3Map({});
    setKeysLoading({});

    (async () => {
      try {
        const params = txnFiltersToParams(applied, {
          page: String(page),
        });
        const res = await fetch(`/api/armaghan/transactions?${params}`, {
          signal: ac.signal,
        });
        const data = await res.json();
        if (!alive) return;
        if (!res.ok || !data.ok) {
          setError(data.message || "بارگذاری ناموفق");
          return;
        }
        setItems(Array.isArray(data.items) ? data.items : []);
        setTotal(Number(data.total || 0));
        setTotalPages(Number(data.totalPages || 1));
        const returnedPage = Number(data.page || page);
        if (Number.isFinite(returnedPage) && returnedPage >= 1 && returnedPage !== page) {
          setPage(returnedPage);
        }
        setDb(data.dbLabel || data.db || "");
      } catch (err) {
        if (!alive) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("خطای شبکه");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
      ac.abort();
    };
  }, [applied, page, dbEpoch]);

  const family =
    applied.family === "mostamari" ? "mostamari" : "yarane";

  async function loadPayedRows(trId: number) {
    if (payedLoading[trId] || payedCounts[trId] != null) return;
    setPayedLoading((s) => ({ ...s, [trId]: true }));
    try {
      const res = await fetch(
        `/api/armaghan/transactions/${trId}/stats?family=${family}&fields=payedRows`,
      );
      const data = await res.json();
      if (res.ok && data.ok) {
        setPayedCounts((s) => ({
          ...s,
          [trId]: Number(data.payedRows || 0),
        }));
      }
    } catch {
      /* keep dash */
    } finally {
      setPayedLoading((s) => ({ ...s, [trId]: false }));
    }
  }

  async function loadKeys(trId: number) {
    if (keysLoading[trId] || key2Map[trId] !== undefined) return;
    setKeysLoading((s) => ({ ...s, [trId]: true }));
    try {
      const res = await fetch(
        `/api/armaghan/transactions/${trId}/stats?family=${family}&fields=keys`,
      );
      const data = await res.json();
      if (res.ok && data.ok) {
        setKey2Map((s) => ({
          ...s,
          [trId]: data.key2 ? String(data.key2) : null,
        }));
        setKey3Map((s) => ({
          ...s,
          [trId]: data.key3 ? String(data.key3) : null,
        }));
      }
    } catch {
      /* keep dash */
    } finally {
      setKeysLoading((s) => ({ ...s, [trId]: false }));
    }
  }

  const columns = ["Id", "Title", "Date", "Registrar", "payedRows", "Key2", "Key3"];
  const rows = useMemo(
    () =>
      items.map((r) => ({
        Id: r.Id,
        Title: formatTxnTitleFa(r.Title),
        Date: formatFaDate(r.Date),
        Registrar: r.RegistrarLabel || r.Registrar,
        payedRows: payedCounts[r.Id] ?? null,
        Key2: null,
        Key3: null,
      })),
    [items, payedCounts],
  );

  function applyFilters(next?: TxnFilterValues) {
    const f = next || filters;
    setFilters(f);
    setApplied(f);
    setPage(1);
    const fam = f.family === "mostamari" ? "mostamari" : "yarane";
    const current =
      searchParams.get("family") === "mostamari" ? "mostamari" : "yarane";
    if (current !== fam) {
      router.replace(fam === "yarane" ? "/" : `/?family=${fam}`);
    }
  }

  return (
    <div className="txn-layout">
      <aside className="txn-layout__filters panel p-3 space-y-2">
        <div className="text-sm font-semibold">فیلترها</div>
        <div className="text-[11px] text-[var(--ink-soft)] leading-5">
          {db || "…"} · {statusLabelFa(applied.status)}
        </div>
        <TxnFilterBar
          value={filters}
          onChange={setFilters}
          loading={loading}
          hidePeopleList
          clearDefaults={{ status: "approved", family: applied.family }}
          onApply={applyFilters}
        />
        {error ? (
          <div className="rounded-xl bg-[#fde6e9] text-[var(--bad)] px-3 py-2 text-xs">
            {error}
          </div>
        ) : null}
      </aside>

      <div className="txn-layout__table panel overflow-hidden">
        <div className="p-3 border-b border-[var(--line)]">
          <TxnTableToolbar
            value={filters}
            onChange={setFilters}
            loading={loading}
            onApply={applyFilters}
          />
        </div>
        <div className="p-3 sm:p-4">
          <FaDataTable
            columns={columns}
            rows={rows}
            empty={
              applied.status === "draft"
                ? "پیش‌نویسی نیست"
                : applied.status === "approved"
                  ? "تراکنش تاییدشده‌ای نیست"
                  : "تراکنشی نیست"
            }
            rowKey={(row) => Number(row.Id)}
            onRowClick={(row) => {
              const id = Number(row.Id);
              if (family === "mostamari") {
                const item = items.find((x) => x.Id === id);
                const ky = (item?.Key1 || "").trim();
                const kyQ = ky ? `&ky=${encodeURIComponent(ky)}` : "";
                router.push(
                  `/request/new?family=mostamari&trId=${id}${kyQ}`,
                );
                return;
              }
              router.push(`/request/new?trId=${id}`);
            }}
            page={page}
            totalPages={totalPages}
            total={total}
            loading={loading}
            onPageChange={setPage}
            renderCell={(col, row) => {
              const id = Number(row.Id);
              if (col === "payedRows") {
                return (
                  <LazyPayedRowsCell
                    value={
                      typeof row.payedRows === "number" ? row.payedRows : null
                    }
                    loading={!!payedLoading[id]}
                    onLoad={() => void loadPayedRows(id)}
                  />
                );
              }
              if (col === "Key2") {
                const loaded = key2Map[id] !== undefined;
                return (
                  <LazyDashCell
                    loaded={loaded}
                    loading={!!keysLoading[id]}
                    onLoad={() => void loadKeys(id)}
                    title="بارگذاری وضعیت لیست افراد"
                    icon={<ListFieldIcon />}
                  >
                    {loaded ? (key2Map[id] ? "✓" : "—") : null}
                  </LazyDashCell>
                );
              }
              if (col === "Key3") {
                const loaded = key3Map[id] !== undefined;
                return (
                  <LazyDashCell
                    loaded={loaded}
                    loading={!!keysLoading[id]}
                    onLoad={() => void loadKeys(id)}
                    title="بارگذاری وضعیت دیسکت بانک"
                    icon={<BankFieldIcon />}
                  >
                    {loaded ? (key3Map[id] ? "✓" : "—") : null}
                  </LazyDashCell>
                );
              }
              return undefined;
            }}
          />
        </div>
      </div>
    </div>
  );
}
