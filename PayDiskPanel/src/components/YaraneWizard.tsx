"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FaDataTable } from "@/components/FaDataTable";
import { LoadingBlock, LoadingSpinner } from "@/components/LoadingSpinner";
import { PersianDatePicker } from "@/components/PersianDatePicker";
import {
  defaultYaraneTxnTitle,
  formatFaDateForTitle,
  formatTxnTitleFa,
} from "@/lib/format";
import {
  WIZARD_STEPS,
  getYaraneDocType,
  type WizardStepId,
  type YaraneDocType,
} from "@/lib/wizard/yarane-types";
import {
  MOSTAMARI_EXPORT_FORMATS,
  MOSTAMARI_EXPORT_IBN_SCOPES,
  suggestMostamariExport,
  type MostamariExportFormat,
  type MostamariExportIbnScope,
} from "@/lib/mostamari/export-formats";
import { UiSelect } from "@/components/UiSelect";

type Family = "yarane" | "mostamari" | null;

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function stepIndex(id: WizardStepId) {
  return WIZARD_STEPS.findIndex((s) => s.id === id);
}

function SupplySelect({
  id,
  value,
  onChange,
  docTypes,
  extraTypes,
  disabled,
}: {
  id: string;
  value: number | "";
  onChange: (v: number | "") => void;
  docTypes: YaraneDocType[];
  extraTypes: YaraneDocType[];
  disabled?: boolean;
}) {
  const options = [
    ...docTypes.map((t) => ({
      value: String(t.supplyLocationId),
      label: `#${t.supplyLocationId} · ${t.shortFa}`,
      title: t.titleFa || t.shortFa,
    })),
    ...extraTypes.map((t) => ({
      value: String(t.supplyLocationId),
      label: `#${t.supplyLocationId} · ${t.shortFa}`,
      title: `${t.titleFa || t.shortFa} · خارج از فهرست اصلی سند`,
    })),
  ];
  return (
    <UiSelect
      id={id}
      searchable={!disabled}
      searchPlaceholder="جستجوی کد یا عنوان…"
      placeholder="انتخاب کنید…"
      value={value === "" ? "" : String(value)}
      options={options}
      disabled={disabled}
      onChange={(v) => {
        if (disabled) return;
        onChange(v ? Number(v) : "");
      }}
    />
  );
}

function SupplyLockedLabel({
  selectedType,
  supplyLocationId,
}: {
  selectedType: YaraneDocType | null;
  supplyLocationId: number | "";
}) {
  if (selectedType) {
    return (
      <div className="mt-2 text-sm font-semibold">
        #{selectedType.supplyLocationId} · {selectedType.shortFa}
        <div className="text-xs font-normal text-[var(--ink-soft)] mt-1 leading-5">
          {selectedType.titleFa}
        </div>
      </div>
    );
  }
  if (supplyLocationId !== "") {
    return (
      <div className="mt-2 text-sm font-semibold">#{supplyLocationId}</div>
    );
  }
  return (
    <div className="mt-2 text-sm text-[var(--bad)]">
      محل تأمین مشخص نیست — از مرحله «محل تأمین اعتبار» انتخاب کنید
    </div>
  );
}

export function YaraneWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlTrId = Number(searchParams.get("trId") || 0) || null;
  const urlType =
    Number(searchParams.get("type") || searchParams.get("supply") || 0) || null;

  const [step, setStep] = useState<WizardStepId>("family");
  const [family, setFamily] = useState<Family>(null);
  const [supplyLocationId, setSupplyLocationId] = useState<number | "">(
    () => (urlType && urlType > 0 ? urlType : ""),
  );
  /** After leaving «محل تأمین»، supply (and family) stay read-only. */
  const [priorStepsLocked, setPriorStepsLocked] = useState(
    () => !!(urlTrId || (urlType && urlType > 0)),
  );
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayIso());
  const [trId, setTrId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingTxn, setLoadingTxn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [labOk, setLabOk] = useState(false);
  const [db, setDb] = useState("");
  const [payedRows, setPayedRows] = useState(0);
  const [supplyCount, setSupplyCount] = useState(0);
  const [subsidySum, setSubsidySum] = useState(0);
  const [sampleRows, setSampleRows] = useState<Record<string, unknown>[]>([]);
  const [samplePage, setSamplePage] = useState(1);
  const [sampleTotalPages, setSampleTotalPages] = useState(1);
  const [sampleTotal, setSampleTotal] = useState(0);
  const [listRows, setListRows] = useState<Record<string, unknown>[]>([]);
  const [listCols, setListCols] = useState<string[]>([]);
  const [listPage, setListPage] = useState(1);
  const [listTotalPages, setListTotalPages] = useState(1);
  const [listTotal, setListTotal] = useState(0);
  const [listLoaded, setListLoaded] = useState(false);
  /** all | without-ibn — filter for «نمایش فاقد شبا» */
  const [listIbnScope, setListIbnScope] = useState<"all" | "without-ibn">("all");
  const [exportFormat, setExportFormat] =
    useState<MostamariExportFormat>("csv-excel");
  const [exportBusy, setExportBusy] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [approved, setApproved] = useState(false);
  const [key2, setKey2] = useState<string | null>(null);
  const [key3, setKey3] = useState<string | null>(null);
  const [docTypes, setDocTypes] = useState<YaraneDocType[]>([]);
  const [extraTypes, setExtraTypes] = useState<YaraneDocType[]>([]);
  const [canCreate, setCanCreate] = useState(true);
  const [canApproveAccess, setCanApproveAccess] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  /** Exclusive highlight on list toolbar (only one primary at a time). */
  const [listActionActive, setListActionActive] = useState<
    "refresh" | "without-ibn" | "download" | null
  >(null);
  const [sayahChecked, setSayahChecked] = useState(false);
  const [sayahGateOk, setSayahGateOk] = useState(false);
  const [sayahMsg, setSayahMsg] = useState<string | null>(null);
  const [sayahOverride, setSayahOverride] = useState(false);
  const [sayahStats, setSayahStats] = useState<{
    checked: number;
    matchCount: number;
    mismatchCount: number;
    errorCount: number;
    totalEligible: number;
  } | null>(null);
  const [sayahMismatches, setSayahMismatches] = useState<
    Array<{
      nationalId: string;
      shebaId: string;
      result: { message: string | null };
    }>
  >([]);
  const [sayahLimit, setSayahLimit] = useState(30);
  const [compareBusy, setCompareBusy] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [compareResult, setCompareResult] = useState<{
    messageFa?: string;
    noteFa?: string;
    allMatch?: boolean;
    mismatchCount?: number;
    done?: {
      calculated?: boolean;
      peopleList?: boolean;
      bankDisk?: boolean;
      gate?: string | null;
    };
    diffs?: Array<{
      field: string;
      labelFa: string;
      ours: string;
      ops: string;
      match: boolean;
    }>;
  } | null>(null);

  const selectedType = useMemo(() => {
    if (supplyLocationId === "") return null;
    const id = Number(supplyLocationId);
    return (
      docTypes.find((t) => t.supplyLocationId === id) ||
      extraTypes.find((t) => t.supplyLocationId === id) ||
      getYaraneDocType(id)
    );
  }, [supplyLocationId, docTypes, extraTypes]);

  const idx = stepIndex(step);

  const loadTxn = useCallback(async (id: number) => {
    setLoadingTxn(true);
    setError(null);
    try {
      const res = await fetch(`/api/wizard/yarane?trId=${id}`);
      const data = await res.json();
      setLabOk(!!data.labWrites);
      setDb(data.dbLabel || data.db || "");
      if (Array.isArray(data.types)) setDocTypes(data.types);
      if (Array.isArray(data.extraTypes)) setExtraTypes(data.extraTypes);
      if (data.access) {
        setCanCreate(!!data.access.canCreate);
        setCanApproveAccess(!!data.access.canApprove);
        setIsAdmin(data.access.role === "admin");
      }
      if (!res.ok || !data.ok || !data.transaction) {
        // Only probe mostamari on clear 404 — avoid doubling a slow/failed load.
        if (res.status === 404) {
          try {
            const mRes = await fetch(`/api/wizard/mostamari?trId=${id}`);
            const mData = await mRes.json();
            if (mRes.ok && mData.ok && mData.header?.Id) {
              const typeQ = mData.header.typeId
                ? `&type=${encodeURIComponent(mData.header.typeId)}`
                : "";
              router.replace(
                `/request/new?family=mostamari&trId=${id}${typeQ}`,
              );
              return;
            }
          } catch {
            /* fall through */
          }
        }
        setError(data.message || "بارگذاری تراکنش ناموفق");
        return;
      }
      const t = data.transaction;
      setFamily("yarane");
      setTrId(Number(t.trId));
      {
        const raw = String(t.title || "");
        const fa = formatTxnTitleFa(raw);
        setTitle(fa === "—" ? "" : fa);
      }
      setDate(t.date || todayIso());
      {
        const fromApi = t.supplyLocationId ? Number(t.supplyLocationId) : 0;
        const fromUrl = urlType && urlType > 0 ? urlType : 0;
        const nextSupply = fromApi || fromUrl;
        if (nextSupply > 0) {
          setSupplyLocationId(nextSupply);
          setPriorStepsLocked(true);
          // Keep type in URL so refresh / soft-nav does not drop supply
          const want = `/request/new?trId=${Number(t.trId)}&type=${nextSupply}`;
          if (
            typeof window !== "undefined" &&
            `${window.location.pathname}${window.location.search}` !== want
          ) {
            router.replace(want);
          }
        }
      }
      setPayedRows(Number(t.payedRows || 0));
      setSupplyCount(Number(t.supplyCount || 0));
      setSubsidySum(Number(t.subsidySum || 0));
      setSampleRows(t.sampleRows || []);
      setSamplePage(Number(t.samplePage || 1));
      setSampleTotalPages(Number(t.sampleTotalPages || 1));
      setSampleTotal(Number(t.sampleTotal || t.payedRows || 0));
      setKey2(t.key2 != null ? String(t.key2) : null);
      setKey3(t.key3 != null ? String(t.key3) : null);
      setApproved(!!t.approved);
      setCompareResult(null);
      setCompareOpen(false);
      setCompareError(null);
      {
        const raw = String(t.step || "calculate");
        // Old wizard had «مبالغ یارانه»; that table now lives under Settings.
        const next: WizardStepId =
          raw === "thresholds"
            ? "approve"
            : WIZARD_STEPS.some((s) => s.id === raw)
              ? (raw as WizardStepId)
              : "calculate";
        setStep(next);
      }
      setMsg(`تراکنش #${t.trId}`);
    } catch {
      setError("خطای شبکه در بارگذاری تراکنش");
    } finally {
      setLoadingTxn(false);
    }
  }, [router, urlType]);

  function clearWizardState() {
    setStep("family");
    setFamily(null);
    setSupplyLocationId("");
    setPriorStepsLocked(false);
    setTitle("");
    setDate(todayIso());
    setTrId(null);
    setPayedRows(0);
    setSupplyCount(0);
    setSubsidySum(0);
    setSampleRows([]);
    setSamplePage(1);
    setSampleTotalPages(1);
    setSampleTotal(0);
    setListRows([]);
    setListCols([]);
    setListPage(1);
    setListTotalPages(1);
    setListTotal(0);
    setListLoaded(false);
    setListIbnScope("all");
    setListActionActive(null);
    setExportModalOpen(false);
    setExportBusy(false);
    setApproved(false);
    setKey2(null);
    setKey3(null);
    setCompareResult(null);
    setCompareOpen(false);
    setCompareError(null);
    setMsg(null);
    setError(null);
  }

  const refreshDbMeta = useCallback(async () => {
    try {
      const res = await fetch("/api/wizard/yarane");
      const d = await res.json();
      if (typeof d.labWrites === "boolean") setLabOk(!!d.labWrites);
      setDb(d.dbLabel || d.db || "");
      if (Array.isArray(d.types)) setDocTypes(d.types);
      if (Array.isArray(d.extraTypes)) setExtraTypes(d.extraTypes);
      if (d.access) {
        setCanCreate(!!d.access.canCreate);
        setCanApproveAccess(!!d.access.canApprove);
        setIsAdmin(d.access.role === "admin");
      }
    } catch {
      /* keep last known labOk/db — don't flash false read-only */
    }
  }, []);

  useEffect(() => {
    if (urlTrId) {
      void loadTxn(urlTrId);
      return;
    }
    // Soft-nav from /request/new?trId=… → /request/new keeps the page mounted;
    // clear local state so «درخواست جدید» actually starts fresh.
    clearWizardState();
    void refreshDbMeta();
  }, [urlTrId, loadTxn, refreshDbMeta]);

  useEffect(() => {
    const onDb = () => {
      if (urlTrId) void loadTxn(urlTrId);
      else void refreshDbMeta();
    };
    window.addEventListener("paydisk-db-changed", onDb);
    const onStorage = (e: StorageEvent) => {
      if (e.key === "paydisk-db-target") onDb();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("paydisk-db-changed", onDb);
      window.removeEventListener("storage", onStorage);
    };
  }, [urlTrId, loadTxn, refreshDbMeta]);

  async function post(action: string, body: Record<string, unknown> = {}) {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/wizard/yarane", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      const data = await res.json();
      if (data.db) setDb(String(data.db));
      if (typeof data.labWrites === "boolean") setLabOk(!!data.labWrites);
      if (!res.ok || !data.ok) {
        setError(data.message || "خطا");
        return null;
      }
      setMsg(data.result?.message || "OK");
      return data;
    } catch {
      setError("خطای شبکه");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function createTxn() {
    if (!selectedType) return;
    const defaultTitle =
      title.trim() || defaultYaraneTxnTitle(selectedType.shortFa, date);
    const data = await post("create", {
      title: defaultTitle,
      date,
      description: selectedType.titleFa,
      supplyLocationId: selectedType.supplyLocationId,
    });
    if (!data) return;
    const newId = Number(data.result.trId);
    setTitle(defaultTitle);
    setTrId(newId);
    if (data.result.supplyLocationId) {
      setSupplyLocationId(Number(data.result.supplyLocationId));
    } else {
      setSupplyLocationId(selectedType.supplyLocationId);
    }
    setStep("sayahMatch");
    router.replace(
      `/request/new?trId=${newId}&type=${selectedType.supplyLocationId}`,
    );
  }

  async function runCompare() {
    if (!trId) return;
    setCompareBusy(true);
    setCompareError(null);
    setCompareOpen(true);
    try {
      const res = await fetch(
        `/api/wizard/yarane?action=compare&trId=${trId}`,
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setCompareResult(null);
        setCompareError(data.message || "مقایسه ناموفق");
        return;
      }
      setCompareResult(data);
    } catch {
      setCompareResult(null);
      setCompareError("خطای شبکه در مقایسه");
    } finally {
      setCompareBusy(false);
    }
  }

  const hasPeopleListDone = !!(key2 && String(key2).trim());
  const hasBankDone = !!(key3 && String(key3).trim());
  const txnDoneStatus =
    trId != null ? (
      <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-3 space-y-3">
        <div className="text-sm font-semibold">وضعیت فعلی تراکنش (خواندن از دیتابیس)</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
          <div className="rounded-lg border border-[var(--line)] bg-white px-2.5 py-2">
            <div className="text-[var(--ink-soft)]">محاسبه</div>
            <div className="font-semibold mt-0.5">
              {payedRows > 0
                ? `${payedRows.toLocaleString("fa-IR")} ردیف`
                : "انجام نشده"}
            </div>
          </div>
          <div className="rounded-lg border border-[var(--line)] bg-white px-2.5 py-2">
            <div className="text-[var(--ink-soft)]">محل تأمین</div>
            <div className="font-semibold mt-0.5 leading-5">
              {selectedType
                ? selectedType.shortFa
                : supplyLocationId !== ""
                  ? `#${supplyLocationId}`
                  : "—"}
            </div>
          </div>
          <div className="rounded-lg border border-[var(--line)] bg-white px-2.5 py-2">
            <div className="text-[var(--ink-soft)]">لیست افراد</div>
            <div className="font-semibold mt-0.5">
              {hasPeopleListDone ? "انجام شده" : "انجام نشده"}
            </div>
          </div>
          <div className="rounded-lg border border-[var(--line)] bg-white px-2.5 py-2">
            <div className="text-[var(--ink-soft)]">دیسکت بانک</div>
            <div className="font-semibold mt-0.5">
              {hasBankDone ? "انجام شده" : "انجام نشده"}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <button
            type="button"
            className="btn btn-ghost text-xs"
            disabled={compareBusy || !trId}
            onClick={() => void runCompare()}
          >
            {compareBusy ? <LoadingSpinner size="sm" inline /> : null}
            اگر محاسبه می‌کردیم — مقایسه با سند
          </button>
          <span className="text-[11px] text-[var(--ink-soft)]">
            بدون نوشتن؛ فقط مقایسه کوئری پنل با سند عملیات
          </span>
        </div>
        {compareOpen ? (
          <div className="rounded-xl border border-[var(--line)] bg-white p-3 space-y-2 text-xs">
            {compareError ? (
              <p className="text-[var(--bad)]">{compareError}</p>
            ) : compareBusy ? (
              <p className="text-[var(--ink-soft)]">در حال مقایسه…</p>
            ) : compareResult ? (
              <>
                <p
                  className={
                    compareResult.allMatch
                      ? "text-[var(--brand)] font-semibold"
                      : "text-[var(--accent)] font-semibold"
                  }
                >
                  {compareResult.messageFa}
                </p>
                {compareResult.done?.gate ? (
                  <p className="text-[var(--ink-soft)]">
                    دروازه سند: {compareResult.done.gate}
                  </p>
                ) : null}
                {compareResult.noteFa ? (
                  <p className="text-[var(--ink-soft)] leading-5">
                    {compareResult.noteFa}
                  </p>
                ) : null}
                <div className="overflow-auto">
                  <table className="data text-xs w-full">
                    <thead>
                      <tr>
                        <th>فیلد</th>
                        <th>پنل (ما)</th>
                        <th>سند عملیات</th>
                        <th>نتیجه</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(compareResult.diffs || []).map((d) => (
                        <tr key={d.field}>
                          <td>{d.labelFa}</td>
                          <td className="wrap">{d.ours}</td>
                          <td className="wrap">{d.ops}</td>
                          <td>{d.match ? "✓" : "≠"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    ) : null;

  async function runCalculate() {
    if (!trId || supplyLocationId === "") return;
    const data = await post("calculate", {
      trId,
      supplyLocationId: Number(supplyLocationId),
    });
    if (!data) return;
    setPayedRows(Number(data.result.payedRows || 0));
    setSupplyCount(Number(data.result.supplyCount || 0));
    setStep("check");
    await loadReview();
  }

  async function loadReview(page = samplePage) {
    if (!trId) return;
    const data = await post("review", { trId, page, pageSize: 15 });
    if (!data) return;
    setPayedRows(Number(data.result.payedRows || 0));
    setSupplyCount(Number(data.result.supplyCount || 0));
    setSubsidySum(Number(data.result.subsidySum || 0));
    setSampleRows(data.result.sampleRows || []);
    setSamplePage(Number(data.result.page || page));
    setSampleTotalPages(Number(data.result.totalPages || 1));
    setSampleTotal(Number(data.result.total || data.result.payedRows || 0));
  }

  async function loadPersonList(
    page = listPage,
    ibnScope: "all" | "without-ibn" = listIbnScope,
  ) {
    if (!trId) return;
    const data = await post("person_list", {
      trId,
      page,
      pageSize: 25,
      ibnScope,
    });
    if (!data) return;
    setListIbnScope(ibnScope);
    setListRows(data.result.rows || []);
    setListCols(data.result.columns || []);
    setListPage(Number(data.result.page || page));
    setListTotalPages(Number(data.result.totalPages || 1));
    setListTotal(Number(data.result.total || 0));
    setListLoaded(true);
  }

  const exportAdvice = useMemo(
    () => suggestMostamariExport(listTotal || payedRows),
    [listTotal, payedRows],
  );

  const canDownloadDiskette =
    !!trId && (payedRows > 0 || listLoaded || listTotal > 0);

  function openExportModal() {
    if (!canDownloadDiskette) return;
    setExportFormat(exportAdvice.format);
    setExportModalOpen(true);
  }

  function startDisketteDownload(
    format: MostamariExportFormat,
    ibnScope: MostamariExportIbnScope,
  ) {
    if (!canDownloadDiskette || !trId) return;
    const scopeLabel =
      MOSTAMARI_EXPORT_IBN_SCOPES.find((s) => s.id === ibnScope)?.labelFa ||
      ibnScope;
    setExportBusy(true);
    setExportModalOpen(false);
    setError(null);
    setMsg(
      `دانلود دیسکت (${scopeLabel}) شروع شد — فایل به‌صورت جریانی ذخیره می‌شود.`,
    );
    const url = `/api/wizard/yarane/export?trId=${trId}&format=${encodeURIComponent(format)}&ibn=${encodeURIComponent(ibnScope)}`;
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => setExportBusy(false), 2000);
  }

  async function approve() {
    if (!trId) return;
    const data = await post("approve", { trId });
    if (!data) return;
    const k2 = data.result?.key2 != null ? String(data.result.key2) : null;
    if (k2) setKey2(k2);
    setApproved(true);
    setMsg(data.result?.message || data.message || `تراکنش #${trId} تایید شد`);
    setStep("approve");
  }

  async function cancelTxn() {
    if (!trId || !labOk) return;
    const ok = window.confirm(
      `لغو ایمن تراکنش #${trId}؟\n\n۱) پاک شدن Key2/Key3\n۲) حذف ردیف‌های محاسبه (PayedMakeOvers)\n۳) حذف هدر تراکنش\n\nاین کار برگشت‌پذیر نیست.`,
    );
    if (!ok) return;
    const again = window.confirm(
      `تایید نهایی: تراکنش #${trId} برای همیشه لغو شود؟`,
    );
    if (!again) return;
    const data = await post("cancel", { trId, deleteHeader: true });
    if (!data) return;
    setMsg(data.result?.message || `تراکنش #${trId} لغو شد`);
    clearWizardState();
    router.replace("/request/new");
  }

  const sampleCols = useMemo(() => {
    if (!sampleRows.length) return [] as string[];
    return Object.keys(sampleRows[0]);
  }, [sampleRows]);

  function goToStep(next: WizardStepId) {
    setError(null);
    setStep(next);
    if (next === "list" && trId) {
      setListPage(1);
      void loadPersonList(1);
    }
    if (next === "check" && trId) {
      setSamplePage(1);
      void loadReview(1);
    }
  }

  function resetNew() {
    clearWizardState();
    router.replace("/request/new");
  }

  // Opening ?trId=…: hide stepper until load finishes so we don't flash «خانواده» then jump.
  const bootingExisting = !!urlTrId && loadingTxn && trId == null;

  return (
    <div className="space-y-5">
      {isAdmin ? (
        <div className="text-xs text-[var(--ink-soft)]">
          {db || (loadingTxn ? "…" : "")}
          {trId ? ` · تراکنش #${trId}` : urlTrId ? ` · تراکنش #${urlTrId}` : ""}
        </div>
      ) : null}

      {!loadingTxn && !labOk ? (
        <div className="rounded-xl bg-[#fff1db] text-[#a15c00] px-4 py-3 text-sm">
          نوشتن/محاسبه روی دیتابیس فعال ({db || "…"}) مجاز نیست — تولید (155) با
          دسترسی نوشتن یا آزمایشی را انتخاب کنید.
        </div>
      ) : null}

      {loadingTxn ? (
        <LoadingBlock label="بارگذاری تراکنش…" />
      ) : null}

      {bootingExisting ? null : (
      <>
      <nav
        className="stepper"
        style={{ gridTemplateColumns: `repeat(${WIZARD_STEPS.length}, minmax(0, 1fr))` }}
      >
        {WIZARD_STEPS.map((s, i) => {
          const state = i === idx ? "is-active" : i < idx ? "is-done" : "";
          return (
            <button
              key={s.id}
              type="button"
              className={`stepper-item ${state}`}
              onClick={() => goToStep(s.id)}
              title={s.optional ? `${s.label} (اختیاری)` : s.label}
            >
              <div className="stepper-dot">{i < idx ? "✓" : i + 1}</div>
              <div className="stepper-label">
                <div>{s.label}</div>
                {s.optional ? (
                  <div className="font-normal opacity-80 text-[10px] mt-0.5">اختیاری</div>
                ) : null}
              </div>
            </button>
          );
        })}
      </nav>

      {error ? (
        <div className="rounded-xl bg-[#fde6e9] text-[var(--bad)] px-4 py-3 text-sm">{error}</div>
      ) : null}
      {msg ? <div className="text-xs text-[var(--brand)]">{msg}</div> : null}

      {step === "family" ? (
        <div className="panel p-5 space-y-4">
          <h2 className="font-[family-name:var(--font-display)] text-2xl">نوع دیسکت را انتخاب کنید</h2>
          {priorStepsLocked ? (
            <>
              <div className="rounded-xl border border-[var(--line)] p-3 text-sm font-semibold">
                یارانه مراکز
              </div>
              <p className="text-[11px] text-[var(--ink-soft)]">
                از مرحله قبل قفل است — برای شروع دوباره از «درخواست جدید» استفاده کنید.
              </p>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => goToStep("type")}
              >
                ادامه
              </button>
            </>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  className={`type-card text-right ${family === "yarane" ? "is-selected" : ""}`}
                  onClick={() => setFamily("yarane")}
                >
                  <div className="font-semibold">یارانه مراکز</div>
                </button>
                <button
                  type="button"
                  className={`type-card text-right ${family === "mostamari" ? "is-selected" : ""}`}
                  onClick={() => setFamily("mostamari")}
                >
                  <div className="font-semibold">مستمری</div>
                </button>
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={!family}
                onClick={() => {
                  if (family === "mostamari") {
                    router.push("/request/new?family=mostamari");
                    return;
                  }
                  setStep("type");
                }}
              >
                ادامه
              </button>
            </>
          )}
        </div>
      ) : null}

      {step === "type" ? (
        <div className="panel p-5 space-y-4">
          <h2 className="font-[family-name:var(--font-display)] text-2xl">
            یافتن کد محل تأمین اعتبار
          </h2>
          <div className="field max-w-xl">
            <label htmlFor="yrn-type">کد محل تأمین اعتبار</label>
            {priorStepsLocked || trId ? (
              <>
                <SupplyLockedLabel
                  selectedType={selectedType}
                  supplyLocationId={supplyLocationId}
                />
                <p className="text-[11px] text-[var(--ink-soft)] mt-2">
                  انتخاب‌های مراحل قبل قفل است و قابل تغییر نیست.
                </p>
              </>
            ) : (
              <SupplySelect
                id="yrn-type"
                value={supplyLocationId}
                onChange={setSupplyLocationId}
                docTypes={docTypes}
                extraTypes={extraTypes}
              />
            )}
          </div>
          {!priorStepsLocked && !trId && !docTypes.length && !extraTypes.length ? (
            <p className="text-sm text-[var(--bad)]">
              هیچ نوع تراکنشی برای حساب شما تعریف نشده — از ادمین در تنظیمات دسترسی بخواهید.
            </p>
          ) : null}
          {!priorStepsLocked && !trId && selectedType ? (
            <p className="text-sm text-[var(--ink-soft)] leading-7">
              {selectedType.titleFa}
              {!selectedType.fromDoc ? " · خارج از فهرست اصلی سند" : ""}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setStep("family")}
              disabled={!!trId || priorStepsLocked}
            >
              قبلی
            </button>
            <button
              type="button"
              className={trId ? "btn btn-ghost" : "btn btn-primary"}
              disabled={
                supplyLocationId === "" ||
                busy ||
                (!trId && (!labOk || !canCreate || !date))
              }
              onClick={() => {
                if (selectedType) {
                  setTitle(defaultYaraneTxnTitle(selectedType.shortFa, date));
                }
                setPriorStepsLocked(true);
                if (trId) {
                  goToStep("sayahMatch");
                  return;
                }
                void createTxn();
              }}
            >
              {busy && !trId ? (
                <LoadingSpinner label="در حال ثبت…" size="sm" inline />
              ) : trId ? (
                "ادامه"
              ) : (
                "ثبت تراکنش و ادامه"
              )}
            </button>
          </div>
        </div>
      ) : null}

      {step === "sayahMatch" ? (
        <div className="panel p-5 space-y-4">
          <h2 className="font-[family-name:var(--font-display)] text-2xl">
            تطبیق شبا (سیاح)
          </h2>
          <p className="text-sm text-[var(--ink-soft)] leading-7">
            قبل از محاسبه، شناسه ملی/حقوقی مراکز ↔ شبا در سامانه سیاح بانک مرکزی
            بررسی می‌شود تا دیسکت یارانه با عدم تطابق صادر نشود.
          </p>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              <span className="text-[var(--ink-soft)]">تعداد نمونه</span>
              <select
                className="rounded-lg border border-[var(--line)] px-2 py-1 bg-white"
                value={sayahLimit}
                disabled={busy}
                onChange={(e) => setSayahLimit(Number(e.target.value) || 30)}
              >
                {[10, 20, 30, 50].map((n) => (
                  <option key={n} value={n}>
                    {n.toLocaleString("fa-IR")}
                  </option>
                ))}
              </select>
            </label>
            {sayahStats ? (
              <span className="text-xs text-[var(--ink-soft)]">
                واجد شرایط: {sayahStats.totalEligible.toLocaleString("fa-IR")} ·
                بررسی: {sayahStats.checked.toLocaleString("fa-IR")} · تطبیق:{" "}
                {sayahStats.matchCount.toLocaleString("fa-IR")} · عدم تطبیق:{" "}
                {sayahStats.mismatchCount.toLocaleString("fa-IR")}
              </span>
            ) : null}
          </div>
          {sayahMsg ? (
            <div
              className={`rounded-xl px-4 py-3 text-sm ${
                sayahGateOk
                  ? "bg-[#e8f4ee] text-[#1f7a4d]"
                  : "bg-[#fdecea] text-[#a33]"
              }`}
            >
              {sayahMsg}
            </div>
          ) : !sayahChecked ? (
            <p className="text-xs text-[var(--ink-soft)]">
              هنوز بررسی انجام نشده — «اجرای تطبیق سیاح» را بزنید.
            </p>
          ) : null}
          {sayahMismatches.length > 0 ? (
            <FaDataTable
              columns={["nationalId", "shebaId", "message"]}
              columnTitles={{
                nationalId: "شناسه",
                shebaId: "شبا",
                message: "نتیجه",
              }}
              rows={sayahMismatches.slice(0, 50).map((r) => ({
                nationalId: r.nationalId,
                shebaId: r.shebaId,
                message: r.result.message || "عدم تطبیق",
              }))}
              empty="—"
            />
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => setStep("type")}
            >
              قبلی
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                setSayahMsg(null);
                try {
                  const res = await fetch("/api/sayah/match", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "batch",
                      scope: "yarane-center",
                      limit: sayahLimit,
                    }),
                  });
                  const data = await res.json();
                  if (!res.ok || !data.ok) {
                    setSayahChecked(true);
                    setSayahGateOk(false);
                    setSayahMsg(data.message || "خطا در فراخوانی سیاح");
                    setError(data.message || "خطا در فراخوانی سیاح");
                    return;
                  }
                  setSayahChecked(true);
                  setSayahGateOk(!!data.gateOk);
                  setSayahMsg(data.message || null);
                  setSayahStats({
                    checked: Number(data.checked || 0),
                    matchCount: Number(data.matchCount || 0),
                    mismatchCount: Number(data.mismatchCount || 0),
                    errorCount: Number(data.errorCount || 0),
                    totalEligible: Number(data.totalEligible || 0),
                  });
                  setSayahMismatches(
                    Array.isArray(data.mismatches) ? data.mismatches : [],
                  );
                } catch {
                  setSayahChecked(true);
                  setSayahGateOk(false);
                  setError("خطای شبکه در تطبیق سیاح");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? <LoadingSpinner size="sm" inline /> : null}
              اجرای تطبیق سیاح
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={
                busy ||
                !sayahChecked ||
                (!sayahGateOk && !isAdmin && !sayahOverride)
              }
              onClick={() => {
                if (!sayahGateOk && isAdmin) setSayahOverride(true);
                goToStep("calculate");
              }}
            >
              ادامه به محاسبه
            </button>
          </div>
          {!sayahGateOk && sayahChecked && isAdmin ? (
            <p className="text-xs text-[var(--ink-soft)]">
              به‌عنوان ادمین می‌توانید با وجود عدم تطبیق ادامه دهید.
            </p>
          ) : null}
        </div>
      ) : null}

      {step === "calculate" ? (
        <div className="panel p-5 space-y-4">
          <h2 className="font-[family-name:var(--font-display)] text-2xl">محاسبه تراکنش</h2>
          <div className="grid sm:grid-cols-3 gap-3 text-sm">
            <div className="rounded-xl border border-[var(--line)] p-3">
              <div className="text-xs text-[var(--ink-soft)]">شناسه تراکنش</div>
              <div className="font-semibold mt-1">#{trId || "—"}</div>
            </div>
            <div className="rounded-xl border border-[var(--line)] p-3">
              <div className="text-xs text-[var(--ink-soft)]">عنوان</div>
              <div className="font-semibold mt-1">{title || "—"}</div>
            </div>
            <div className="rounded-xl border border-[var(--line)] p-3">
              <div className="text-xs text-[var(--ink-soft)]">کد محل تأمین اعتبار</div>
              <div className="font-semibold mt-1">
                {selectedType
                  ? `#${selectedType.supplyLocationId} · ${selectedType.shortFa}`
                  : supplyLocationId !== ""
                    ? `#${supplyLocationId}`
                    : "—"}
              </div>
            </div>
          </div>
          {!sayahGateOk && !sayahOverride && payedRows <= 0 ? (
            <div className="rounded-xl bg-[#fff8e6] text-[#8a6d1d] px-4 py-3 text-sm">
              ابتدا مرحلهٔ «تطبیق شبا» را با موفقیت انجام دهید.
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setStep("sayahMatch")}
            >
              قبلی
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={
                busy ||
                !labOk ||
                !trId ||
                supplyLocationId === "" ||
                (!sayahGateOk && !sayahOverride && payedRows <= 0)
              }
              title={
                labOk
                  ? "اجرای CalculateMarakezYarane روی دیتابیس فعال"
                  : "هدف فعلی فقط خواندنی است — lab یا تولید (155) با دسترسی نوشتن را انتخاب کنید"
              }
              onClick={runCalculate}
            >
              {busy ? (
                <LoadingSpinner
                  label={payedRows > 0 ? "در حال اجرای مجدد…" : "در حال محاسبه…"}
                  size="sm"
                  inline
                />
              ) : payedRows > 0 ? (
                "اجرای مجدد"
              ) : (
                "اجرای محاسبه"
              )}
            </button>
            {payedRows > 0 ? (
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy}
                onClick={() => goToStep("check")}
              >
                ادامه
              </button>
            ) : null}
            {!labOk ? (
              <span className="text-xs text-[var(--ink-soft)] self-center">
                هدف فعلی خواندنی است — برای اجرا، lab یا تولید (155) با نوشتن را انتخاب کنید
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {step === "check" ? (
        <div className="panel p-5 space-y-4">
          <h2 className="font-[family-name:var(--font-display)] text-2xl">بررسی صحت تراکنش</h2>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-[var(--line)] p-3">
              <div className="text-xs text-[var(--ink-soft)]">تعداد ردیف محاسبه</div>
              <div className="font-semibold mt-1 text-lg">
                {payedRows.toLocaleString("fa-IR")}
              </div>
            </div>
            <div className="rounded-xl border border-[var(--line)] p-3">
              <div className="text-xs text-[var(--ink-soft)]">محل تأمین</div>
              <div className="font-semibold mt-1 text-sm leading-6">
                {selectedType
                  ? selectedType.titleFa
                  : supplyLocationId !== ""
                    ? `#${supplyLocationId}`
                    : "—"}
              </div>
            </div>
            <div className="rounded-xl border border-[var(--line)] p-3">
              <div className="text-xs text-[var(--ink-soft)]">جمع یارانه</div>
              <div className="font-semibold mt-1 text-lg">
                {subsidySum.toLocaleString("fa-IR")}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setStep("calculate")}>
              قبلی
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => loadReview(samplePage)}
            >
              بروزرسانی
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy || payedRows <= 0}
              onClick={() => goToStep("list")}
            >
              ادامه
            </button>
          </div>
          <FaDataTable
            columns={sampleCols}
            rows={sampleRows}
            empty="نمونه‌ای نیست"
            page={samplePage}
            totalPages={sampleTotalPages}
            total={sampleTotal}
            loading={busy}
            onPageChange={(p) => {
              setSamplePage(p);
              void loadReview(p);
            }}
          />
        </div>
      ) : null}

      {step === "list" ? (
        <div className="panel p-5 space-y-4">
          <h2 className="font-[family-name:var(--font-display)] text-2xl">تهیه لیست افراد</h2>
          <p className="text-sm text-[var(--ink-soft)] leading-7">
            نمونهٔ فهرست افراد؛ برای فایل کامل از «دانلود دیسکت» استفاده کنید (با شبا /
            بدون شبا / همه).
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setStep("check")}>
              قبلی
            </button>
            <button
              type="button"
              className={`btn ${listActionActive === "refresh" ? "btn-primary" : "btn-ghost"}`}
              disabled={busy}
              onClick={() => {
                setListActionActive("refresh");
                void loadPersonList(listPage, "all");
              }}
            >
              بروزرسانی لیست
            </button>
            <button
              type="button"
              className={`btn ${listActionActive === "without-ibn" ? "btn-primary" : "btn-ghost"}`}
              disabled={busy || !trId || payedRows <= 0}
              title="افراد/مراکزی که Center.IBN خالی است"
              onClick={() => {
                setListActionActive("without-ibn");
                setListPage(1);
                void loadPersonList(1, "without-ibn");
              }}
            >
              نمایش فاقد شبا
            </button>
            <button
              type="button"
              className={`btn ${listActionActive === "download" ? "btn-primary" : "btn-ghost"}`}
              disabled={!canDownloadDiskette || exportBusy}
              title={
                canDownloadDiskette
                  ? "انتخاب قالب و نوع لیست (با شبا / بدون شبا / همه)"
                  : "پس از محاسبه و وجود ردیف پرداخت فعال می‌شود"
              }
              onClick={() => {
                setListActionActive("download");
                openExportModal();
              }}
            >
              {exportBusy ? <LoadingSpinner size="sm" inline /> : null}
              دانلود دیسکت
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setListActionActive(null);
                goToStep("approve");
              }}
            >
              ادامه
            </button>
          </div>
          {listIbnScope === "without-ibn" ? (
            <p className="text-xs text-[var(--ink-soft)]">
              فیلتر فعال: فقط فاقد شبا
              {listTotal > 0
                ? ` · ${listTotal.toLocaleString("fa-IR")} ردیف`
                : ""}
              {" · "}
              <button
                type="button"
                className="text-[var(--brand)] underline"
                disabled={busy}
                onClick={() => {
                  setListActionActive("refresh");
                  setListPage(1);
                  void loadPersonList(1, "all");
                }}
              >
                نمایش همه
              </button>
            </p>
          ) : null}
          <FaDataTable
            columns={listCols}
            rows={listRows}
            empty={
              busy
                ? "…"
                : listIbnScope === "without-ibn"
                  ? "فاقد شبا یافت نشد"
                  : "ردیفی نیست"
            }
            page={listPage}
            totalPages={listTotalPages}
            total={listTotal}
            loading={busy}
            onPageChange={(p) => {
              setListPage(p);
              void loadPersonList(p, listIbnScope);
            }}
          />
        </div>
      ) : null}

      {exportModalOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="yarane-export-title"
          onClick={() => !exportBusy && setExportModalOpen(false)}
        >
          <div
            className="panel w-full max-w-lg p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3
                  id="yarane-export-title"
                  className="font-[family-name:var(--font-display)] text-xl"
                >
                  دانلود دیسکت یارانه
                </h3>
                <p className="text-xs text-[var(--ink-soft)] mt-1">
                  تراکنش #{trId}
                  {listTotal > 0
                    ? ` · حدود ${listTotal.toLocaleString("fa-IR")} ردیف`
                    : payedRows > 0
                      ? ` · حدود ${payedRows.toLocaleString("fa-IR")} ردیف`
                      : ""}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost text-sm"
                disabled={exportBusy}
                onClick={() => setExportModalOpen(false)}
              >
                بستن
              </button>
            </div>

            <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-3 text-xs space-y-1.5">
              <p className="leading-6">{exportAdvice.reasonFa}</p>
              <p className="text-[var(--ink-soft)]">
                پیشنهاد:{" "}
                <strong>
                  {MOSTAMARI_EXPORT_FORMATS.find(
                    (f) => f.id === exportAdvice.format,
                  )?.labelFa || exportAdvice.format}
                </strong>
                {" · "}
                زمان تقریبی: {exportAdvice.etaFa}
              </p>
              <p className="text-[var(--ink-soft)] leading-5">
                {exportAdvice.waitTipFa}
              </p>
              <button
                type="button"
                className="btn btn-ghost text-xs"
                onClick={() => setExportFormat(exportAdvice.format)}
              >
                اعمال پیشنهاد قالب
              </button>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">قالب فایل</legend>
              {MOSTAMARI_EXPORT_FORMATS.map((f) => {
                const suggested = f.id === exportAdvice.format;
                return (
                  <label
                    key={f.id}
                    className={`flex gap-2 items-start rounded-xl border px-3 py-2 cursor-pointer ${
                      exportFormat === f.id
                        ? "border-[var(--brand)] bg-white"
                        : "border-[var(--line)]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="yarane-export-format"
                      className="mt-1"
                      checked={exportFormat === f.id}
                      onChange={() => setExportFormat(f.id)}
                    />
                    <span className="text-sm leading-6">
                      <span className="font-semibold">
                        {f.labelFa}
                        {suggested ? " · پیشنهادی" : ""}
                      </span>
                      <br />
                      <span className="text-xs text-[var(--ink-soft)]">
                        {f.hintFa}
                      </span>
                    </span>
                  </label>
                );
              })}
            </fieldset>

            <div className="space-y-2">
              <p className="font-semibold text-sm">دانلود بر اساس شبا (مرکز)</p>
              <div className="grid gap-2">
                {MOSTAMARI_EXPORT_IBN_SCOPES.map((scope) => (
                  <button
                    key={scope.id}
                    type="button"
                    className="btn btn-primary w-full justify-center"
                    disabled={exportBusy || !canDownloadDiskette}
                    title={scope.hintFa}
                    onClick={() =>
                      startDisketteDownload(exportFormat, scope.id)
                    }
                  >
                    {exportBusy ? <LoadingSpinner size="sm" inline /> : null}
                    {scope.labelFa}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {step === "approve" ? (
        <div className="panel p-5 space-y-4">
          <h2 className="font-[family-name:var(--font-display)] text-2xl">
            {approved ? "تایید شد" : "تایید"}
          </h2>
          {isAdmin ? txnDoneStatus : null}
          {approved ? (
            <>
              <p className="text-sm leading-7">
                تراکنش <strong>#{trId}</strong> آماده است و در فهرست تراکنش‌های ارمغان قابل مشاهده
                است.
                {key2 ? (
                  <>
                    {" "}
                    فایل لیست: <span dir="ltr">{key2}</span>
                  </>
                ) : null}
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href="/" className="btn btn-primary">
                  بازگشت به فهرست تراکنش ها
                </Link>
                <button type="button" className="btn btn-ghost" onClick={resetNew}>
                  تراکنش جدید
                </button>
                <button
                  type="button"
                  className="btn btn-ghost text-[var(--bad)]"
                  disabled={busy || !trId || !labOk}
                  title="پاک کردن Key2/Key3، حذف محاسبه و حذف هدر"
                  onClick={() => void cancelTxn()}
                >
                  {busy ? <LoadingSpinner size="sm" inline /> : null}
                  لغو تراکنش
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => goToStep("list")}>
                قبلی
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || !trId || payedRows <= 0 || !canApproveAccess}
                onClick={approve}
              >
                {busy ? <LoadingSpinner label="در حال تایید…" size="sm" inline /> : "تایید و علامت لیست افراد"}
              </button>
              <button
                type="button"
                className="btn btn-ghost text-[var(--bad)]"
                disabled={busy || !trId || !labOk}
                title="اگر محاسبه اشتباه بود — قبل یا بعد از تایید"
                onClick={() => void cancelTxn()}
              >
                {busy ? <LoadingSpinner size="sm" inline /> : null}
                لغو تراکنش
              </button>
            </div>
          )}
          {trId && labOk ? (
            <p className="text-[11px] text-[var(--ink-soft)] leading-5">
              لغو ایمن: ابتدا علامت لیست/بانک پاک می‌شود، سپس ردیف‌های محاسبه حذف و در
              نهایت هدر تراکنش پاک می‌گردد.
            </p>
          ) : null}
        </div>
      ) : null}
      </>
      )}

    </div>
  );
}
