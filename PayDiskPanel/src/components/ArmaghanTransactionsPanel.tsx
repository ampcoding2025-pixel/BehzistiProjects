"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ArmaghanStageId, ArmaghanTxnListItem } from "@/lib/armaghan/inspect";
import { FaDataTable } from "@/components/FaDataTable";
import {
  BankFieldIcon,
  LazyDashCell,
  LazyPayedRowsCell,
  ListFieldIcon,
} from "@/components/LazyDashCell";
import { LoadingBlock } from "@/components/LoadingSpinner";
import {
  EMPTY_TXN_FILTERS,
  TxnFilterBar,
  TxnTableToolbar,
  txnFiltersToParams,
  type TxnFilterValues,
} from "@/components/TxnFilterBar";
import { formatFaDate, formatTxnTitleFa } from "@/lib/format";
import { columnTitleFa } from "@/lib/reports/columns-fa";

type Detail = {
  header: {
    Id: number;
    Title: string | null;
    Date: string | null;
    Acceptor: string | null;
    Description: string | null;
    Registrar: string | null;
    RegistrarName?: string | null;
    RegistrarLabel?: string | null;
    RegistrationDateTime: string | null;
    Key1: string | null;
    Key2: string | null;
    Key3: string | null;
    DefinitionId?: number | null;
    DefinitionTitle?: string | null;
    DefinitionSupplyLocationId?: number | null;
  };
  aggregates: {
    payedRows: number;
    supplyCount: number;
    subsidySum: number;
    minFromDate: string | null;
    maxFromDate: string | null;
  };
  supplies: Array<{ Id: number; Title: string; Keyword: string; cnt: number }>;
  sampleRows: Record<string, unknown>[];
  samplePage?: number;
  samplePageSize?: number;
  sampleTotal?: number;
  sampleTotalPages?: number;
  stage: ArmaghanStageId;
  stageLabel: string;
  deviations: string[];
  reachedStepIndex: number;
  stages: Array<{ id: ArmaghanStageId; label: string; armaghan: string }>;
  note: string;
};

type Check = {
  id: string;
  title: string;
  ok: boolean;
  detail: string;
  severity: "info" | "warn" | "critical";
};

type ManagerBrief = {
  transactionId: number;
  title: string | null;
  date: string | null;
  verdict: string;
  verdictFa: string;
  recommendation: string;
  facts: string[];
  actionsAllowedInPanel: string[];
  actionsForbiddenInPanel: string[];
};

type ScriptMeta = {
  id: string;
  titleFa: string;
  description: string;
  managerWhy: string;
  defaultLimit: number;
};

type ScriptsCatalog = {
  suggestedType: { supplyLocationId: number | null; titleFa: string; keyword: string | null };
  disketteTypes: Array<{ id: number; titleFa: string; keyword: string | null }>;
  scripts: ScriptMeta[];
};

type ScriptRun = {
  script: ScriptMeta & { family?: string };
  columns: string[];
  rows: Record<string, unknown>[];
  ms: number;
  note?: string;
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
};

const SEV = {
  info: { bg: "#e8eef3", color: "#3d5166" },
  warn: { bg: "#fff1db", color: "#a15c00" },
  critical: { bg: "#fde6e9", color: "#a11f2c" },
} as const;

function fmt(v: unknown) {
  if (v == null || v === "") return "—";
  if (typeof v === "object") return JSON.stringify(v);
  const s = String(v);
  // ISO date → YYYY-MM-DD or local-ish without Z noise
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      const hasTime = !s.includes("T00:00:00");
      return hasTime
        ? d.toLocaleString("fa-IR")
        : d.toLocaleDateString("fa-IR");
    }
  }
  return s;
}

function hasValue(v: unknown) {
  return v != null && String(v).trim() !== "";
}

function Field({
  label,
  value,
  hideEmpty = false,
}: {
  label: string;
  value: unknown;
  hideEmpty?: boolean;
}) {
  if (hideEmpty && !hasValue(value)) return null;
  return (
    <div className="rounded-xl border border-[var(--line)] p-3">
      <div className="text-xs text-[var(--ink-soft)]">{label}</div>
      <div className="mt-1 text-sm font-semibold break-words leading-6">{fmt(value)}</div>
    </div>
  );
}

export function ArmaghanTransactionsPanel() {
  const router = useRouter();
  const [filters, setFilters] = useState<TxnFilterValues>(EMPTY_TXN_FILTERS);
  const [applied, setApplied] = useState<TxnFilterValues>(EMPTY_TXN_FILTERS);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ArmaghanTxnListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [db, setDb] = useState("");

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [viewStep, setViewStep] = useState(0);
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [brief, setBrief] = useState<ManagerBrief | null>(null);
  const [checksLoading, setChecksLoading] = useState(false);
  const [scriptsCat, setScriptsCat] = useState<ScriptsCatalog | null>(null);
  const [selectedSupplyType, setSelectedSupplyType] = useState<number | "">("");
  const [selectedScriptId, setSelectedScriptId] = useState("yrn-gate-key2");
  const [scriptRun, setScriptRun] = useState<ScriptRun | null>(null);
  const [scriptBusy, setScriptBusy] = useState(false);
  const [scriptPage, setScriptPage] = useState(1);
  const [samplePage, setSamplePage] = useState(1);
  const [labWrites, setLabWrites] = useState(false);
  const [labBusy, setLabBusy] = useState(false);
  const [labMsg, setLabMsg] = useState<string | null>(null);
  const [dbEpoch, setDbEpoch] = useState(0);
  const [payedCounts, setPayedCounts] = useState<Record<number, number>>({});
  const [payedLoading, setPayedLoading] = useState<Record<number, boolean>>({});
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

    const timeoutId = window.setTimeout(() => ac.abort(), 45000);

    (async () => {
      try {
        const params = txnFiltersToParams(applied, { page: String(page) });
        const res = await fetch(`/api/armaghan/transactions?${params}`, {
          signal: ac.signal,
        });
        const data = await res.json();
        if (!alive) return;
        if (!res.ok || !data.ok) {
          setError(data.message || "بارگذاری تراکنش‌ها ناموفق");
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
        setLabWrites(data.mode === "test" || data.readonly === false);
      } catch (err) {
        if (!alive) return;
        if (err instanceof DOMException && err.name === "AbortError") {
          setError("بارگذاری طولانی شد — فیلتر را ساده‌تر کنید یا هدف دیتابیس را عوض کنید");
          return;
        }
        setError("خطای شبکه");
      } finally {
        window.clearTimeout(timeoutId);
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
      window.clearTimeout(timeoutId);
      ac.abort();
    };
  }, [applied, page, dbEpoch]);

  async function openTxn(id: number, nextSamplePage = 1) {
    setSelectedId(id);
    if (nextSamplePage === 1) {
      setDetail(null);
      setChecks(null);
      setBrief(null);
      setScriptsCat(null);
      setScriptRun(null);
      setScriptPage(1);
    }
    setSamplePage(nextSamplePage);
    setDetailLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        samplePage: String(nextSamplePage),
        samplePageSize: "15",
      });
      const [res, scriptsRes] = await Promise.all([
        fetch(`/api/armaghan/transactions/${id}?${params}`),
        nextSamplePage === 1
          ? fetch(`/api/armaghan/transactions/${id}/scripts`)
          : Promise.resolve(null),
      ]);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.message || "جزئیات تراکنش ناموفق");
        return;
      }
      setDetail(data.detail);
      if (nextSamplePage === 1) {
        setViewStep(data.detail.reachedStepIndex ?? 0);
      }

      if (scriptsRes) {
        const sc = await scriptsRes.json();
        if (scriptsRes.ok && sc.ok) {
          setScriptsCat(sc);
          const sid = sc.suggestedType?.supplyLocationId;
          setSelectedSupplyType(sid ?? "");
          setSelectedScriptId(
            sc.scripts?.[4]?.id || sc.scripts?.[0]?.id || "yrn-gate-key2",
          );
        }
      }
    } catch {
      setError("خطای شبکه در جزئیات");
    } finally {
      setDetailLoading(false);
    }
  }

  async function runDocScript(nextPage = 1) {
    if (!selectedId || !selectedScriptId) return;
    setScriptBusy(true);
    setError(null);
    setScriptPage(nextPage);
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: "25",
        limit: "25",
      });
      const res = await fetch(
        `/api/armaghan/transactions/${selectedId}/scripts/${selectedScriptId}?${params}`,
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.message || "اجرای اسکریپت سند ناموفق");
        return;
      }
      setScriptRun({
        script: data.script,
        columns: data.columns,
        rows: data.rows,
        ms: data.ms,
        note: data.note,
        page: data.page,
        pageSize: data.pageSize,
        total: data.total,
        totalPages: data.totalPages,
      });
    } catch {
      setError("خطای شبکه در اسکریپت سند");
    } finally {
      setScriptBusy(false);
    }
  }

  async function runLabAction(
    action: "calculate_yarane" | "mark_list" | "clear_list" | "mark_bank" | "clear_bank",
  ) {
    if (!selectedId) return;
    setLabBusy(true);
    setLabMsg(null);
    setError(null);
    try {
      const body: Record<string, unknown> = { action };
      if (action === "calculate_yarane") {
        if (selectedSupplyType === "") {
          setError("برای Calculate ابتدا نوع دیسکت / محل تأمین را انتخاب کنید");
          return;
        }
        body.supplyLocationId = selectedSupplyType;
      }
      const res = await fetch(`/api/armaghan/transactions/${selectedId}/lab`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.message || "عملیات lab ناموفق");
        return;
      }
      setLabMsg(data.result?.message || "OK");
      await openTxn(selectedId);
    } catch {
      setError("خطای شبکه در عملیات lab");
    } finally {
      setLabBusy(false);
    }
  }

  async function runManagerReport() {
    if (!selectedId) return;
    setChecksLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/armaghan/transactions/${selectedId}/deviations`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.message || "گزارش انحراف ناموفق");
        return;
      }
      setChecks(data.checks);
      setBrief(data.managerBrief || null);
      if (detail?.stages) {
        const idx = detail.stages.findIndex((s) => s.id === "manager");
        if (idx >= 0) setViewStep(idx);
      }
    } catch {
      setError("خطای شبکه در گزارش مدیر");
    } finally {
      setChecksLoading(false);
    }
  }

  const stages = detail?.stages || [];
  const maxStep = Math.max(0, stages.length - 1);

  const stepId = stages[viewStep]?.id;

  const sampleCols = useMemo(() => {
    if (!detail?.sampleRows?.length) return [] as string[];
    return Object.keys(detail.sampleRows[0]);
  }, [detail]);

  const isMostamari = applied.family === "mostamari";
  const family = isMostamari ? "mostamari" : "yarane";

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

  const listColumns = isMostamari
    ? ["Id", "Title", "Date", "Registrar", "payedRows", "Ky", "List", "Export"]
    : [
        "Id",
        "Title",
        "Date",
        "Registrar",
        "payedRows",
        "Key2",
        "Key3",
        "stageLabel",
      ];

  const listRows = useMemo(
    () =>
      items.map((r) =>
        isMostamari
          ? {
              Id: r.Id,
              Title: formatTxnTitleFa(r.Title),
              Date: formatFaDate(r.Date),
              Registrar: r.RegistrarLabel || r.Registrar,
              payedRows: payedCounts[r.Id] ?? null,
              Ky: r.Key1 || "—",
              List: null,
              Export: null,
            }
          : {
              Id: r.Id,
              Title: formatTxnTitleFa(r.Title),
              Date: formatFaDate(r.Date),
              Registrar: r.RegistrarLabel || r.Registrar,
              payedRows: payedCounts[r.Id] ?? null,
              Key2: null,
              Key3: null,
              stageLabel: r.stageLabel,
            },
      ),
    [items, isMostamari, payedCounts],
  );

  const supplyRows = useMemo(
    () =>
      (detail?.supplies || []).map((s) => ({
        Id: s.Id,
        Title: s.Title,
        Keyword: s.Keyword,
        cnt: s.cnt,
      })),
    [detail],
  );

  return (
    <div className="space-y-4">
      <div className="txn-layout">
        <aside className="txn-layout__filters panel p-3 space-y-2">
          <div className="text-sm font-semibold">فیلترها</div>
          <div className="text-[11px] text-[var(--ink-soft)] leading-5">
            {db || "…"}
          </div>
          <TxnFilterBar
            value={filters}
            onChange={setFilters}
            loading={loading}
            onApply={(next) => {
              const f = next || filters;
              setFilters(f);
              setApplied(f);
              setPage(1);
              if (f.family === "mostamari") {
                setSelectedId(null);
                setDetail(null);
              }
            }}
          />
        </aside>

        <div className="txn-layout__table panel overflow-hidden">
          <div className="p-3 border-b border-[var(--line)]">
            <TxnTableToolbar
              value={filters}
              onChange={setFilters}
              loading={loading}
              onApply={(next) => {
                const f = next || filters;
                setFilters(f);
                setApplied(f);
                setPage(1);
              }}
            />
          </div>
          <div className="p-3 sm:p-4">
            <FaDataTable
              columns={listColumns}
              rows={listRows}
              empty="تراکنشی یافت نشد"
              activeRowKey={isMostamari ? null : selectedId}
              rowKey={(row) => Number(row.Id)}
              onRowClick={(row) => {
                if (isMostamari) {
                  // Prefer type id from list Key1 (Ky); wizard accepts type= mst-*
                  const rawKy = String(row.Ky || "").trim();
                  const ky =
                    rawKy && rawKy !== "—"
                      ? `&ky=${encodeURIComponent(rawKy)}`
                      : "";
                  router.push(
                    `/request/new?family=mostamari&trId=${Number(row.Id)}${ky}`,
                  );
                  return;
                }
                router.push(`/request/new?trId=${Number(row.Id)}`);
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
                if (col === "Key2" || col === "List") {
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
                if (col === "Key3" || col === "Export") {
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
            {isMostamari ? (
              <div className="text-xs text-[var(--ink-soft)] mt-2 px-1">
                روی ردیف کلیک کنید تا ویزارد مستمری (محاسبه / لیست / تایید) باز شود.
              </div>
            ) : selectedId ? (
              <div className="text-xs text-[var(--ink-soft)] mt-2 px-1">
                انتخاب‌شده: #{selectedId}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="panel p-4 md:p-5 space-y-4 min-w-0">
        {error ? (
          <div className="rounded-xl bg-[#fde6e9] text-[var(--bad)] px-4 py-3 text-sm">{error}</div>
        ) : null}

        {!selectedId ? (
          <div className="text-sm text-[var(--ink-soft)] py-8 text-center">
            یک تراکنش را انتخاب کنید
          </div>
        ) : null}

        {detailLoading ? (
          <LoadingBlock label="در حال بارگذاری جزئیات…" />
        ) : null}

        {detail ? (
          <>
            <div>
              <div className="text-xs text-[var(--ink-soft)] font-mono">#{detail.header.Id}</div>
              <h2 className="font-[family-name:var(--font-display)] text-2xl mt-1 leading-9">
                {(() => {
                  const t = formatTxnTitleFa(detail.header.Title);
                  return t === "—" ? "بدون عنوان" : t;
                })()}
              </h2>
            </div>

            <nav
              className="stepper"
              style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}
            >
              {stages.map((s, i) => {
                const reached = i <= detail.reachedStepIndex;
                const state =
                  viewStep === i ? "is-active" : reached ? "is-done" : "";
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`stepper-item ${state}`}
                    onClick={() => setViewStep(i)}
                    title={
                      i > detail.reachedStepIndex
                        ? `${s.armaghan} — هنوز در ارمغان تکمیل نشده (فرم خالی/ناقص)`
                        : s.armaghan
                    }
                  >
                    <div className="stepper-dot">
                      {reached && i < detail.reachedStepIndex ? "✓" : i + 1}
                    </div>
                    <div className="stepper-label">
                      <div>{s.label}</div>
                      <div className="font-normal opacity-80 text-[10px] mt-0.5">
                        {s.armaghan}
                        {i > detail.reachedStepIndex ? " · ناقص" : ""}
                      </div>
                    </div>
                  </button>
                );
              })}
            </nav>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--ink-soft)]">
              <span>
                مرحله فعلی: <strong>{detail.stageLabel}</strong> (
                {detail.reachedStepIndex + 1}/{stages.length})
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-ghost text-xs"
                  disabled={viewStep <= 0}
                  onClick={() => setViewStep((s) => Math.max(0, s - 1))}
                >
                  مرحله قبل
                </button>
                <button
                  type="button"
                  className="btn btn-ghost text-xs"
                  disabled={viewStep >= maxStep}
                  onClick={() => setViewStep((s) => Math.min(maxStep, s + 1))}
                >
                  مرحله بعد
                </button>
              </div>
            </div>

            <div className="border-t border-[var(--line)] pt-4 space-y-4">
              {stepId === "txn" ? (
                <>
                  <h3 className="font-semibold">تراکنش</h3>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Field label="شناسه" value={detail.header.Id} />
                    <Field label="تاریخ مرتبط" value={detail.header.Date} />
                    <Field label="عنوان" value={formatTxnTitleFa(detail.header.Title)} />
                    <Field
                      label="تعریف دیسکت"
                      value={detail.header.DefinitionTitle}
                      hideEmpty
                    />
                    <Field
                      label="محل تأمین تعریف"
                      value={detail.header.DefinitionSupplyLocationId}
                      hideEmpty
                    />
                    <Field
                      label="ثبت‌کننده"
                      value={detail.header.RegistrarLabel || detail.header.Registrar}
                      hideEmpty
                    />
                    <Field
                      label="زمان ثبت"
                      value={detail.header.RegistrationDateTime}
                      hideEmpty
                    />
                    <Field label="تاییدکننده" value={detail.header.Acceptor} hideEmpty />
                    <div className="sm:col-span-2">
                      <Field label="توضیح" value={detail.header.Description} hideEmpty />
                    </div>
                    <Field
                      label={columnTitleFa("Key1")}
                      value={detail.header.Key1}
                      hideEmpty
                    />
                  </div>
                </>
              ) : null}

              {stepId === "type" ? (
                <>
                  <h3 className="font-semibold">نوع محاسبه / محل تأمین</h3>
                  <FaDataTable
                    columns={["Id", "Title", "Keyword", "cnt"]}
                    rows={supplyRows}
                    empty="ردیف محاسبه‌ای نیست"
                  />
                </>
              ) : null}

              {stepId === "calc" ? (
                <>
                  <h3 className="font-semibold">نتیجه محاسبه</h3>
                  {labWrites ? (
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="field min-w-[200px] flex-1">
                        <label htmlFor="calc-supply">محل تأمین</label>
                        <select
                          id="calc-supply"
                          value={selectedSupplyType === "" ? "" : String(selectedSupplyType)}
                          onChange={(e) =>
                            setSelectedSupplyType(e.target.value ? Number(e.target.value) : "")
                          }
                        >
                          <option value="">انتخاب…</option>
                          {(scriptsCat?.disketteTypes || []).map((t) => (
                            <option key={t.id} value={t.id}>
                              #{t.id} · {t.titleFa}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary text-xs"
                        disabled={labBusy || selectedSupplyType === ""}
                        onClick={() => runLabAction("calculate_yarane")}
                      >
                        {labBusy ? "…" : "اجرای محاسبه"}
                      </button>
                      {labMsg ? <span className="text-xs text-[var(--brand)]">{labMsg}</span> : null}
                    </div>
                  ) : null}
                  <div className="grid sm:grid-cols-3 gap-3">
                    <Field label={columnTitleFa("payedRows")} value={detail.aggregates.payedRows} />
                    <Field
                      label={columnTitleFa("supplyCount")}
                      value={detail.aggregates.supplyCount}
                    />
                    <Field
                      label={columnTitleFa("subsidySum")}
                      value={detail.aggregates.subsidySum}
                    />
                    <Field
                      label={columnTitleFa("minFromDate")}
                      value={detail.aggregates.minFromDate}
                    />
                    <Field
                      label={columnTitleFa("maxFromDate")}
                      value={detail.aggregates.maxFromDate}
                    />
                  </div>
                  <FaDataTable
                    columns={sampleCols}
                    rows={detail.sampleRows}
                    empty="ردیف محاسبه نیست"
                    page={detail.samplePage ?? samplePage}
                    totalPages={detail.sampleTotalPages ?? 1}
                    total={detail.sampleTotal ?? detail.aggregates.payedRows}
                    loading={detailLoading}
                    onPageChange={(p) => {
                      if (selectedId) void openTxn(selectedId, p);
                    }}
                  />
                </>
              ) : null}

              {stepId === "list" ? (
                <>
                  <h3 className="font-semibold">لیست افراد</h3>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Field label={columnTitleFa("Key2")} value={detail.header.Key2} />
                    <Field
                      label="وضعیت"
                      value={detail.header.Key2 ? "لیست آماده" : "لیست ساخته نشده"}
                    />
                  </div>
                  {labWrites ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn btn-primary text-xs"
                        disabled={labBusy}
                        onClick={() => runLabAction("mark_list")}
                      >
                        علامت لیست
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost text-xs"
                        disabled={labBusy || !detail.header.Key2}
                        onClick={() => runLabAction("clear_list")}
                      >
                        پاک کردن لیست
                      </button>
                      {labMsg ? <span className="text-xs text-[var(--brand)]">{labMsg}</span> : null}
                    </div>
                  ) : null}
                  {detail.deviations.length ? (
                    <ul className="text-sm text-[var(--warn)] list-disc list-inside leading-7">
                      {detail.deviations.map((d) => (
                        <li key={d}>{d}</li>
                      ))}
                    </ul>
                  ) : null}
                </>
              ) : null}

              {stepId === "manager" ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-semibold">گزارش مدیر</h3>
                    <button
                      type="button"
                      className="btn btn-primary text-xs"
                      disabled={checksLoading}
                      onClick={runManagerReport}
                    >
                      {checksLoading ? "…" : "بازرسی"}
                    </button>
                  </div>

                  {scriptsCat ? (
                    <div className="space-y-3">
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="field">
                          <label htmlFor="diskette-type">نوع دیسکت</label>
                          <select
                            id="diskette-type"
                            value={selectedSupplyType === "" ? "" : String(selectedSupplyType)}
                            onChange={(e) =>
                              setSelectedSupplyType(
                                e.target.value ? Number(e.target.value) : "",
                              )
                            }
                          >
                            <option value="">
                              پیشنهادی: {scriptsCat.suggestedType.titleFa}
                            </option>
                            {scriptsCat.disketteTypes.map((t) => (
                              <option key={t.id} value={t.id}>
                                #{t.id} · {t.titleFa}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field">
                          <label htmlFor="doc-script">گزارش</label>
                          <select
                            id="doc-script"
                            value={selectedScriptId}
                            onChange={(e) => setSelectedScriptId(e.target.value)}
                          >
                            {scriptsCat.scripts.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.titleFa}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary text-xs"
                        disabled={scriptBusy}
                        onClick={() => runDocScript(1)}
                      >
                        {scriptBusy ? "…" : "اجرای گزارش"}
                      </button>
                      {scriptRun ? (
                        <div className="space-y-2">
                          <div className="text-xs text-[var(--ink-soft)]">
                            {scriptRun.script.titleFa}
                            {typeof scriptRun.ms === "number"
                              ? ` · ${scriptRun.ms}ms`
                              : ""}
                          </div>
                          <FaDataTable
                            columns={scriptRun.columns}
                            rows={scriptRun.rows}
                            empty="نتیجه‌ای نیست"
                            page={scriptRun.page ?? scriptPage}
                            totalPages={scriptRun.totalPages ?? 1}
                            total={scriptRun.total}
                            loading={scriptBusy}
                            onPageChange={(p) => void runDocScript(p)}
                          />
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="grid sm:grid-cols-2 gap-3">
                    <Field label={columnTitleFa("Key3")} value={detail.header.Key3} />
                    <Field
                      label="آماده مالی؟"
                      value={
                        detail.header.Key2 && detail.aggregates.payedRows > 0 ? "بله" : "خیر"
                      }
                    />
                  </div>
                  {labWrites ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn btn-primary text-xs"
                        disabled={labBusy}
                        onClick={() => runLabAction("mark_bank")}
                      >
                        علامت بانک
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost text-xs"
                        disabled={labBusy || !detail.header.Key3}
                        onClick={() => runLabAction("clear_bank")}
                      >
                        پاک کردن بانک
                      </button>
                      {labMsg ? <span className="text-xs text-[var(--brand)]">{labMsg}</span> : null}
                    </div>
                  ) : null}
                  {brief ? (
                    <div
                      className="rounded-xl border p-4 space-y-3"
                      style={{
                        borderColor:
                          brief.verdict === "block_finance" || brief.verdict === "inconsistent"
                            ? "#e8a0a8"
                            : brief.verdict === "ready_finance"
                              ? "#8fc9b8"
                              : "var(--line)",
                        background:
                          brief.verdict === "block_finance" || brief.verdict === "inconsistent"
                            ? "#fff5f6"
                            : brief.verdict === "ready_finance"
                              ? "#e8f6f4"
                              : "var(--paper)",
                      }}
                    >
                      <div className="font-[family-name:var(--font-display)] text-xl">
                        {brief.verdictFa}
                      </div>
                      <p className="text-sm leading-7">{brief.recommendation}</p>
                      <ul className="text-xs text-[var(--ink-soft)] list-disc list-inside leading-6">
                        {brief.facts.map((f) => (
                          <li key={f}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  ) : detail.deviations.length ? (
                    <div className="rounded-xl border border-[#f0c9a0] bg-[#fff8f0] p-4 text-sm leading-7">
                      <ul className="list-disc list-inside space-y-1">
                        {detail.deviations.map((d) => (
                          <li key={d}>{d}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {checks ? (
                    <div className="space-y-2">
                      {checks.map((c) => (
                        <div
                          key={c.id}
                          className="rounded-xl border border-[var(--line)] p-3 flex flex-wrap items-start justify-between gap-2"
                        >
                          <div>
                            <div className="font-semibold text-sm">{c.title}</div>
                            <div className="text-xs text-[var(--ink-soft)] mt-1 leading-6">
                              {c.detail}
                            </div>
                          </div>
                          <span
                            className="text-[11px] font-semibold rounded-full px-2 py-1"
                            style={{
                              background: SEV[c.severity].bg,
                              color: SEV[c.severity].color,
                            }}
                          >
                            {c.ok ? "OK" : c.severity}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
