"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { FaDataTable } from "@/components/FaDataTable";
import { LoadingBlock, LoadingSpinner } from "@/components/LoadingSpinner";
import { PersianDatePicker } from "@/components/PersianDatePicker";
import { SayahMatchPanel } from "@/components/SayahMatchPanel";
import { UiSelect } from "@/components/UiSelect";
import {
  MOSTAMARI_TYPES,
  getMostamariType,
  inferMostamariTypeFromKy,
  inferMostamariTypeFromTitle,
  nextPipelineStep,
  pipelineForType,
  prevPipelineStep,
  stepIndexInPipeline,
  type MostamariStepId,
  type MostamariTypeId,
} from "@/lib/mostamari/types";
import { jalaliYearMonth, jalaliYearMonthFromIso } from "@/lib/shamsi";
import {
  MOSTAMARI_EXPORT_FORMATS,
  MOSTAMARI_EXPORT_IBN_SCOPES,
  suggestMostamariExport,
  type MostamariExportFormat,
  type MostamariExportIbnScope,
} from "@/lib/mostamari/export-formats";

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Default Year=YYYYMM from today’s Jalali calendar (editable). */
function defaultYearMonth(isoHint?: string | null) {
  if (isoHint) {
    const fromTxn = jalaliYearMonthFromIso(isoHint);
    if (fromTxn) return fromTxn;
  }
  return jalaliYearMonth();
}

function toIsoDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  const s = String(value).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

function NavButtons(props: {
  onPrev?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  /** Primary step action in the same group (e.g. اجرای محاسبه / بارگذاری گزارش). */
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  actionPrimary?: boolean;
  optional?: boolean;
  onSkip?: () => void;
  skipLabel?: string;
  busy?: boolean;
  homeHref?: string;
  homeLabel?: string;
  children?: ReactNode;
  /** Extra classes on the group row (default keeps full width). */
  className?: string;
}) {
  /** Explicit actionPrimary wins; otherwise action is primary only when there is no «ادامه». */
  const actionBtnPrimary =
    props.actionPrimary === true ||
    (props.actionPrimary !== false && !props.onNext && !!props.onAction);

  return (
    <div
      className={
        props.className || "flex flex-wrap items-center gap-2 w-full"
      }
      role="group"
    >
      {props.onPrev ? (
        <button
          type="button"
          className="btn btn-ghost"
          disabled={props.busy}
          onClick={props.onPrev}
        >
          قبلی
        </button>
      ) : null}
      {props.optional && props.onSkip ? (
        <button
          type="button"
          className="btn btn-ghost"
          disabled={props.busy}
          onClick={props.onSkip}
        >
          {props.skipLabel || "رد شدن از مرحله اختیاری"}
        </button>
      ) : null}
      {props.children}
      {props.actionLabel && props.onAction ? (
        <button
          type="button"
          className={actionBtnPrimary ? "btn btn-primary" : "btn btn-ghost"}
          disabled={props.actionDisabled || props.busy}
          onClick={props.onAction}
        >
          {props.busy ? <LoadingSpinner size="sm" inline /> : null}
          {props.actionLabel}
        </button>
      ) : null}
      {props.homeHref ? (
        <Link href={props.homeHref} className="btn btn-ghost">
          {props.homeLabel || "بازگشت به فهرست"}
        </Link>
      ) : null}
      {props.onNext ? (
        <button
          type="button"
          className={actionBtnPrimary ? "btn btn-ghost" : "btn btn-primary"}
          disabled={props.nextDisabled || props.busy}
          onClick={props.onNext}
        >
          {props.nextLabel || "ادامه"}
        </button>
      ) : null}
    </div>
  );
}

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

export function MostamariWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlTrId = Number(searchParams.get("trId") || 0) || null;
  const urlType = (searchParams.get("type") || "") as MostamariTypeId | "";
  const urlKy = (searchParams.get("ky") || "").trim();

  const inferredFromKy = inferMostamariTypeFromKy(urlKy)?.id || "";

  const [step, setStep] = useState<MostamariStepId>(urlTrId ? "calculate" : "type");
  const [typeId, setTypeId] = useState<MostamariTypeId | "">(
    urlType || inferredFromKy || "",
  );
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayIso());
  const [trId, setTrId] = useState<number | null>(urlTrId);
  const [yearMonth, setYearMonth] = useState(defaultYearMonth());
  const [peerTrId, setPeerTrId] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingTxn, setLoadingTxn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [labOk, setLabOk] = useState(false);
  const [db, setDb] = useState("");
  const [payedRows, setPayedRows] = useState(0);
  const [ky, setKy] = useState<string | null>(null);
  const [listToken, setListToken] = useState<string | null>(null);
  const [bankToken, setBankToken] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
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
      payedRows?: number;
      approved?: boolean;
      peopleList?: boolean;
      bankDisk?: boolean;
      ky?: string | null;
      year?: string | null;
      typeTitleFa?: string | null;
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
  const [moneyHist, setMoneyHist] = useState<Array<{ cnt: number; Money: number }>>([]);
  const [aliveHist, setAliveHist] = useState<Array<{ cnt: number; Money: number }>>([]);
  const [ibnRows, setIbnRows] = useState<Record<string, unknown>[]>([]);
  const [listRows, setListRows] = useState<Record<string, unknown>[]>([]);
  const [listPage, setListPage] = useState(1);
  const [listPageSize, setListPageSize] = useState(10);
  const [listTotalPages, setListTotalPages] = useState(1);
  const [listTotal, setListTotal] = useState(0);
  const [listTotalExact, setListTotalExact] = useState(false);
  const [listCountBusy, setListCountBusy] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  /** Download diskette enabled only after a successful «بارگذاری لیست». */
  const [listLoaded, setListLoaded] = useState(false);
  const [exportFormat, setExportFormat] =
    useState<MostamariExportFormat>("csv-excel");
  const [exportBusy, setExportBusy] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [ibnChecked, setIbnChecked] = useState(false);
  const [ibnPage, setIbnPage] = useState(1);
  const [missingPage, setMissingPage] = useState(1);
  const [pairOnlyA, setPairOnlyA] = useState<Record<string, unknown>[]>([]);
  const [pairOnlyB, setPairOnlyB] = useState<Record<string, unknown>[]>([]);
  const [pairMoney, setPairMoney] = useState<Record<string, unknown>[]>([]);
  const [missingIbn, setMissingIbn] = useState<Record<string, unknown>[]>([]);
  const [skipped, setSkipped] = useState<Partial<Record<MostamariStepId, boolean>>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  /** Exclusive highlight on pay-list toolbar (only one primary at a time). */
  const [listActionActive, setListActionActive] = useState<
    "load" | "download" | null
  >(null);
  /** Exclusive highlight on bank-prep toolbar. */
  const [bankActionActive, setBankActionActive] = useState<
    "missing-ibn" | "download" | null
  >(null);
  /** CBI Sayah Sheba↔NID gate (before calculate). */
  const [sayahChecked, setSayahChecked] = useState(false);
  const [sayahGateOk, setSayahGateOk] = useState(false);

  const selectedType = useMemo(
    () => (typeId ? getMostamariType(typeId) : null),
    [typeId],
  );
  const pipeline = useMemo(() => pipelineForType(typeId || null), [typeId]);
  const idx = stepIndexInPipeline(pipeline, step);
  const currentStep = pipeline[idx] || pipeline[0];
  const isLastStep =
    pipeline.length > 0 && step === pipeline[pipeline.length - 1]?.id;
  const exportAdvice = useMemo(
    () => suggestMostamariExport(listTotal),
    [listTotal],
  );

  const canDownloadDiskette =
    !!trId && (payedRows > 0 || listLoaded || listTotal > 0);
  /** Existing or already-calculated transactions: title/period are read-only. */
  const defineFieldsLocked = !!trId || payedRows > 0;

  async function runCompare() {
    if (!trId) return;
    setCompareBusy(true);
    setCompareError(null);
    setCompareOpen(true);
    try {
      const res = await fetch(
        `/api/wizard/mostamari?action=compare&trId=${trId}`,
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setCompareResult(null);
        setCompareError(data.message || "مقایسه ناموفق");
        return;
      }
      setCompareResult(data);
      if (typeof data.done?.payedRows === "number") {
        setPayedRows(Number(data.done.payedRows) > 0 ? 1 : 0);
        if (!listTotalExact && Number(data.done.payedRows) > 0) {
          setListTotal(Number(data.done.payedRows));
        }
      }
    } catch {
      setCompareResult(null);
      setCompareError("خطای شبکه در مقایسه");
    } finally {
      setCompareBusy(false);
    }
  }

  const hasPeopleListDone = !!(listToken && String(listToken).trim());
  const hasBankDone = !!(bankToken && String(bankToken).trim());
  const calcDone =
    payedRows > 0 ||
    listLoaded ||
    listTotal > 0 ||
    !!(compareResult?.done?.calculated);
  const txnDoneStatus =
    trId != null ? (
      <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-3 space-y-3">
        <div className="text-sm font-semibold">
          وضعیت فعلی تراکنش (خواندن از دیتابیس)
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
          <div className="rounded-lg border border-[var(--line)] bg-white px-2.5 py-2">
            <div className="text-[var(--ink-soft)]">محاسبه</div>
            <div className="font-semibold mt-0.5">
              {calcDone
                ? listTotalExact || compareResult?.done?.payedRows
                  ? `${Number(
                      compareResult?.done?.payedRows || listTotal,
                    ).toLocaleString("fa-IR")} ردیف`
                  : "انجام شده"
                : "انجام نشده"}
            </div>
          </div>
          <div className="rounded-lg border border-[var(--line)] bg-white px-2.5 py-2">
            <div className="text-[var(--ink-soft)]">تایید Ky/Year</div>
            <div className="font-semibold mt-0.5">
              {approved || ky || yearMonth
                ? `${ky || "—"} / ${yearMonth || "—"}`
                : "انجام نشده"}
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
            بدون نوشتن؛ فقط مقایسه کوئری پنل با سند عملیات مستمری
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

  function openExportModal() {
    if (!canDownloadDiskette) return;
    setExportFormat(exportAdvice.format);
    setExportModalOpen(true);
    if (trId && !listTotalExact && !listCountBusy) {
      void refreshListCount(trId, listPageSize);
    }
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
      `دانلود لیست (${scopeLabel}) شروع شد — فایل به‌صورت جریانی ذخیره می‌شود.`,
    );
    const url = `/api/wizard/mostamari/export?trId=${trId}&format=${encodeURIComponent(format)}&ibn=${encodeURIComponent(ibnScope)}`;
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => setExportBusy(false), 2000);
  }

  function openBankModal() {
    if (!canDownloadDiskette) return;
    setBankActionActive("download");
    setBankModalOpen(true);
  }

  function startBankDisketteDownload(ibnScope: MostamariExportIbnScope = "all") {
    if (!trId || !canDownloadDiskette) return;
    const scopeLabel =
      MOSTAMARI_EXPORT_IBN_SCOPES.find((s) => s.id === ibnScope)?.labelFa ||
      ibnScope;
    setBankActionActive("download");
    setExportBusy(true);
    setBankModalOpen(false);
    setError(null);
    setMsg(`دانلود دیسکت بانک (${scopeLabel}) شروع شد`);
    const url = `/api/wizard/mostamari/bank-export?trId=${trId}&ibn=${encodeURIComponent(ibnScope)}`;
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => setExportBusy(false), 2000);
  }

  function goNext() {
    const n = nextPipelineStep(pipeline, step);
    if (n) setStep(n);
  }
  function goPrev() {
    const p = prevPipelineStep(pipeline, step);
    if (p) setStep(p);
  }
  function skipOptional() {
    setSkipped((s) => ({ ...s, [step]: true }));
    setMsg(`مرحله اختیاری «${currentStep?.label || step}» رد شد`);
    goNext();
  }

  const loadMeta = useCallback(async () => {
    try {
      const res = await fetch("/api/wizard/mostamari");
      const data = await res.json();
      if (res.ok && data.ok) {
        setLabOk(!!data.labWrites);
        setDb(data.dbLabel || data.mode || "");
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        const role = d?.access?.role || d?.user?.role;
        setIsAdmin(!!d?.ok && (role === "admin" || !!d?.access?.canSeeSettings));
      })
      .catch(() => setIsAdmin(false));
  }, []);

  const loadTxn = useCallback(async (id: number) => {
    setLoadingTxn(true);
    setError(null);
    try {
      const res = await fetch(`/api/wizard/mostamari?trId=${id}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(
          data.message ||
            "بارگذاری تراکنش مستمری ناموفق — هدف دیتابیس را بررسی کنید (lab/155/157)",
        );
        return;
      }
      const h = data.header;
      setTrId(Number(h.Id));
      setListLoaded(false);
      setListActionActive(null);
      setListRows([]);
      setListTotal(0);
      setListTotalExact(false);
      setListTotalPages(1);
      setTitle(String(h.Title || ""));
      const regIso = toIsoDate(h.RegistrationDate);
      const relIso = toIsoDate(h.RelatedTo);
      // Period picker = RelatedTo (دوره پرداخت); fall back to registration.
      setDate(relIso || regIso || todayIso());
      setPayedRows(Number(h.payedRows || 0));
      setKy(h.Ky || null);
      setListToken(h.ListToken != null ? String(h.ListToken) : null);
      setBankToken(
        h.FileName != null
          ? String(h.FileName)
          : h.ExportToken != null
            ? String(h.ExportToken)
            : null,
      );
      setApproved(!!h.approved);
      setCompareResult(null);
      setCompareOpen(false);
      setCompareError(null);
      if (h.Year) {
        setYearMonth(String(h.Year).replace(/\D/g, "").slice(0, 6));
      } else {
        setYearMonth(defaultYearMonth(relIso || regIso));
      }
      const fromHeader = (h.typeId as MostamariTypeId) || "";
      const fromTitle =
        inferMostamariTypeFromTitle(
          `${h.Title || ""} ${h.Description || ""}`,
        ) || "";
      // Prefer server inference / title over a stale empty URL type.
      setTypeId(fromHeader || fromTitle || urlType || "");
      setLabOk(!!data.labWrites);
      setDb(data.dbLabel || "");
      setMsg(
        fromHeader || fromTitle
          ? `تراکنش مستمری #${h.Id}`
          : `تراکنش مستمری #${h.Id} — نوع را دستی انتخاب کنید`,
      );
      if (Number(h.payedRows || 0) > 0) {
        setStep((s) => (s === "type" || s === "define" ? "calculate" : s));
      }
    } catch {
      setError("خطای شبکه در بارگذاری تراکنش");
    } finally {
      setLoadingTxn(false);
    }
  }, [urlType]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    const onDb = () => {
      void loadMeta();
      if (urlTrId) void loadTxn(urlTrId);
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
  }, [loadMeta, loadTxn, urlTrId]);

  useEffect(() => {
    if (urlTrId) void loadTxn(urlTrId);
  }, [urlTrId, loadTxn]);

  useEffect(() => {
    if (!pipeline.some((s) => s.id === step)) {
      setStep(trId ? "calculate" : "type");
    }
  }, [pipeline, step, trId]);

  /** Auto-load amount histogram when entering «گزارش مبلغ» (no separate mystery button). */
  useEffect(() => {
    if (step !== "report" || !trId) return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      setError(null);
      try {
        if (!cancelled) await refreshReview(trId);
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when step/trId change
  }, [step, trId]);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/wizard/mostamari", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.message || "عملیات ناموفق");
        return null;
      }
      setMsg(data.message || "انجام شد");
      return data;
    } catch {
      setError("خطای شبکه");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function refreshReview(id: number) {
    // Light report only (money groups) — alive/sample are opt-in and slow
    const res = await fetch(
      `/api/wizard/mostamari?action=review&trId=${id}&page=1&pageSize=10`,
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      setError((data as { message?: string }).message || "گزارش مبلغ ناموفق");
      return false;
    }
    setPayedRows(Number(data.total || 0));
    setMoneyHist(Array.isArray(data.moneyHistogram) ? data.moneyHistogram : []);
    setAliveHist([]);
    if (data.header?.Ky) setKy(data.header.Ky);
    if (data.header?.approved != null) setApproved(!!data.header.approved);
    setMsg(data.message || null);
    return true;
  }

  async function loadIbnDup() {
    const res = await fetch("/api/wizard/mostamari?action=ibn-dup&limit=50");
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      setError((data as { message?: string }).message || "بررسی شبا ناموفق");
      setIbnChecked(false);
      return false;
    }
    setIbnRows(Array.isArray(data.rows) ? data.rows : []);
    setIbnChecked(true);
    setIbnPage(1);
    setMsg(data.message || null);
    return true;
  }

  async function refreshListCount(id: number, pageSize = listPageSize) {
    setListCountBusy(true);
    try {
      const res = await fetch(
        `/api/wizard/mostamari?action=list-count&trId=${id}`,
      );
      const data = await res.json();
      if (res.ok && data.ok) {
        const total = Number(data.total || 0);
        const ps = Math.max(1, pageSize);
        setListTotal(total);
        setListTotalExact(true);
        setListTotalPages(Math.max(1, Math.ceil(Math.max(total, 1) / ps) || 1));
      }
    } catch {
      /* keep page-based estimate */
    } finally {
      setListCountBusy(false);
    }
  }

  async function loadList(id: number, page = 1, pageSize = listPageSize) {
    setListLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/wizard/mostamari?action=list&trId=${id}&page=${page}&pageSize=${pageSize}`,
      );
      const data = await res.json();
      if (res.ok && data.ok) {
        const ps = Number(data.pageSize || pageSize);
        const pg = Number(data.page || 1);
        setListRows(Array.isArray(data.rows) ? data.rows : []);
        setListPage(pg);
        setListPageSize(ps);
        setListLoaded(true);
        // Page fetch is fast; exact COUNT_BIG runs in background (was blocking the button).
        if (pg === 1) {
          setListTotal(Number(data.total || 0));
          setListTotalPages(Number(data.totalPages || 1));
          setListTotalExact(false);
          void refreshListCount(id, ps);
        } else {
          setListTotalPages((prev) =>
            Math.max(prev, Number(data.totalPages || pg)),
          );
        }
        setMsg(data.message || null);
      } else {
        setListLoaded(false);
        setError(data.message || "بارگذاری لیست ناموفق");
      }
    } catch {
      setListLoaded(false);
      setError("خطای شبکه در بارگذاری لیست");
    } finally {
      setListLoading(false);
    }
  }

  async function runPairDiff() {
    if (!trId) return;
    const peer = Number(peerTrId);
    if (!peer) {
      setError("شماره تراکنش جفت (مستمری ↔ افزایش) را وارد کنید");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/wizard/mostamari?action=pair-diff&trId=${trId}&peerTrId=${peer}&limit=30`,
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.message || "مقایسه ناموفق");
        return;
      }
      setPairOnlyA(Array.isArray(data.onlyInTrId) ? data.onlyInTrId : []);
      setPairOnlyB(Array.isArray(data.onlyInPeer) ? data.onlyInPeer : []);
      setPairMoney(Array.isArray(data.moneyMismatch) ? data.moneyMismatch : []);
      setMsg(data.message || null);
    } finally {
      setBusy(false);
    }
  }

  async function runMissingIbn() {
    if (!trId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/wizard/mostamari?action=missing-ibn&trId=${trId}&limit=40`,
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.message || "استعلام فاقد شبا ناموفق");
        return;
      }
      setMissingIbn(Array.isArray(data.rows) ? data.rows : []);
      setMsg(null);
    } finally {
      setBusy(false);
    }
  }

  const listColumns = useMemo(() => {
    if (!listRows.length) return [] as string[];
    return Object.keys(listRows[0]);
  }, [listRows]);

  if (loadingTxn && !trId) {
    return <LoadingBlock label="بارگذاری تراکنش مستمری…" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl">
            ویزارد مستمری
          </h1>
          <p className="text-xs text-[var(--ink-soft)] mt-1">
            {db || "…"}
            {labOk ? " · نوشتن مجاز" : " · فقط خواندنی"}
            {trId ? ` · تراکنش #${trId}` : ""}
            {selectedType ? ` · ${selectedType.shortFa}` : ""}
          </p>
        </div>
        <Link href="/?family=mostamari" className="btn btn-ghost text-xs">
          بازگشت به فهرست
        </Link>
      </div>

      <nav className="stepper" aria-label="مراحل مستمری">
        {pipeline.map((s, i) => {
          const active = s.id === step;
          const done = i < idx || !!skipped[s.id];
          return (
            <button
              key={s.id}
              type="button"
              className={`stepper-item ${active ? "is-active" : ""} ${done ? "is-done" : ""}`}
              title={s.hintFa || s.hintEn || s.label}
              onClick={() => {
                if (i <= idx || trId) setStep(s.id);
              }}
            >
              <div className="stepper-dot">{done && !active ? "✓" : i + 1}</div>
              <div className="stepper-label">
                {s.label}
                {s.optional ? (
                  <span className="text-[10px] opacity-70"> · اختیاری</span>
                ) : null}
              </div>
            </button>
          );
        })}
      </nav>

      {currentStep?.hintFa ? (
        <p className="text-xs text-[var(--ink-soft)] leading-5">{currentStep.hintFa}</p>
      ) : null}

      {!labOk ? (
        <div className="rounded-xl bg-[#fff1db] text-[#a15c00] px-4 py-3 text-sm">
          نوشتن/محاسبه روی دیتابیس فعال ({db || "…"}) مجاز نیست — تولید (155) با دسترسی
          نوشتن یا آزمایشی را انتخاب کنید. مشاهده و لیست روی همه اهداف ممکن است.
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl bg-[#fde6e9] text-[var(--bad)] px-4 py-3 text-sm">
          {error}
        </div>
      ) : null}
      {msg ? <div className="text-xs text-[var(--brand)]">{msg}</div> : null}

      {step === "type" ? (
        <div className="panel p-5 space-y-4">
          <h2 className="font-[family-name:var(--font-display)] text-2xl">نوع مستمری</h2>
          <div className="max-w-xl">
            <UiSelect
              id="mst-type-select"
              label="انتخاب نوع"
              searchable
              searchPlaceholder="جستجوی نوع مستمری…"
              placeholder="یک نوع را انتخاب کنید"
              value={typeId || ""}
              options={MOSTAMARI_TYPES.map((t) => ({
                value: t.id,
                label: t.shortFa,
                title: t.titleFa,
              }))}
              onChange={(v) => {
                setTypeId(v as MostamariTypeId);
                setSkipped({});
              }}
            />
          </div>
          <NavButtons
            nextDisabled={!typeId}
            onNext={() => {
              if (selectedType && !title) setTitle(selectedType.shortFa);
              setStep("define");
            }}
          />
        </div>
      ) : null}

      {step === "define" ? (
        <div className="panel p-5 space-y-4">
          <h2 className="font-[family-name:var(--font-display)] text-2xl">تعریف تراکنش</h2>
          <div className="grid sm:grid-cols-2 gap-3 max-w-3xl">
            <div className="field">
              <label htmlFor="mst-title">عنوان</label>
              <input
                id="mst-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثلاً مستمری مهر ۱۴۰۴"
                disabled={defineFieldsLocked}
                readOnly={defineFieldsLocked}
              />
            </div>
            <PersianDatePicker
              id="mst-date"
              label="تاریخ دوره پرداخت"
              value={date}
              onChange={setDate}
              disabled={defineFieldsLocked}
            />
          </div>
          {defineFieldsLocked ? (
            <p className="text-xs text-[var(--ink-soft)] leading-5">
              برای تراکنش ثبت‌شده یا محاسبه‌شده، عنوان و تاریخ دوره قابل ویرایش نیستند.
            </p>
          ) : null}
          <NavButtons
            onPrev={goPrev}
            nextLabel={trId ? "ادامه" : "ثبت تراکنش"}
            nextDisabled={busy || (!trId && (!title.trim() || !labOk))}
            busy={busy && !trId}
            onNext={async () => {
              if (trId) {
                goNext();
                return;
              }
              const data = await post({ action: "create", title, date, typeId });
              if (!data) return;
              setTrId(Number(data.trId));
              router.replace(
                `/request/new?family=mostamari&trId=${data.trId}&type=${typeId}`,
              );
              goNext();
            }}
          />
        </div>
      ) : null}

      {step === "sayahMatch" ? (
        <SayahMatchPanel
          scope={payedRows > 0 && trId ? "mostamari-pay" : "mostamari-ibn"}
          trId={trId}
          isAdmin={isAdmin}
          busy={busy}
          onBusy={setBusy}
          onError={setError}
          gateOk={sayahGateOk}
          onGateChange={setSayahGateOk}
          checked={sayahChecked}
          onCheckedChange={setSayahChecked}
          hint={
            <>
              قبل از محاسبه، نمونهٔ کد ملی ↔ شبا از{" "}
              <code className="text-xs">IBN_AccountNumber</code>
              {payedRows > 0 ? " / لیست پرداخت" : ""} در سامانه سیاح بررسی می‌شود.
            </>
          }
          onPrev={goPrev}
          nextLabel="ادامه به محاسبه"
          nextDisabled={
            !sayahChecked ||
            (!sayahGateOk && !isAdmin && !skipped.sayahMatch)
          }
          onNext={() => {
            if (!sayahGateOk && isAdmin) {
              setSkipped((s) => ({ ...s, sayahMatch: true }));
            }
            goNext();
          }}
        />
      ) : null}

      {step === "calculate" ? (
        <div className="panel p-5 space-y-4">
          <h2 className="font-[family-name:var(--font-display)] text-2xl">محاسبه</h2>
          {!typeId ? (
            <div className="space-y-2">
              <p className="text-sm text-[var(--bad)]">
                نوع تراکنش مشخص نیست — یک نوع انتخاب کنید.
              </p>
              <div className="flex flex-wrap gap-2">
                {MOSTAMARI_TYPES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setTypeId(t.id)}
                  >
                    {t.shortFa}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--ink-soft)] leading-7">
              محاسبهٔ «{selectedType?.shortFa}» برای تراکنش #{trId}. این کار ممکن است چند
              دقیقه طول بکشد؛ صفحه را نبندید.
            </p>
          )}
          <div className="text-sm">
            وضعیت محاسبه:{" "}
            <strong>
              {payedRows > 0
                ? "انجام شده — می‌توانید به گزارش بروید"
                : "هنوز محاسبه نشده"}
            </strong>
          </div>
          {payedRows > 0 && !busy ? (
            <div className="rounded-xl bg-[#e8f4ee] text-[#1f7a4d] px-4 py-3 text-sm">
              این تراکنش قبلاً محاسبه شده است. ادامه دهید یا در صورت نیاز مجدداً محاسبه کنید.
            </div>
          ) : null}
          {busy ? (
            <div className="rounded-xl bg-[#e8f4ee] text-[#1f7a4d] px-4 py-3 text-sm">
              در حال محاسبهٔ {selectedType?.shortFa}… این تب را باز نگه دارید.
            </div>
          ) : null}
          {!sayahGateOk && !skipped.sayahMatch && payedRows <= 0 ? (
            <div className="rounded-xl bg-[#fff8e6] text-[#8a6d1d] px-4 py-3 text-sm">
              ابتدا مرحلهٔ «تطبیق شبا» را با موفقیت انجام دهید (یا از آن مرحله برگردید).
            </div>
          ) : null}
          <NavButtons
            onPrev={goPrev}
            actionLabel={payedRows > 0 ? "اجرای مجدد" : "اجرای محاسبه"}
            actionPrimary
            actionDisabled={
              !trId ||
              !typeId ||
              !labOk ||
              (!sayahGateOk && !skipped.sayahMatch && payedRows <= 0)
            }
            busy={busy}
            onAction={async () => {
              if (!trId || !typeId) return;
              const data = await post({ action: "calculate", trId, typeId });
              if (!data) return;
              setPayedRows(Number(data.payedRows || 0) > 0 ? 1 : 0);
              goNext();
            }}
            nextLabel="ادامه"
            nextDisabled={payedRows <= 0}
            onNext={goNext}
          />
        </div>
      ) : null}

      {step === "report" ? (
        <div className="panel p-5 space-y-4">
          <h2 className="font-[family-name:var(--font-display)] text-2xl">گزارش مبلغ</h2>
          <p className="text-sm text-[var(--ink-soft)] leading-7">
            خلاصهٔ تعداد افراد به تفکیک مبلغ پرداخت. مبالغ نامتعارف را اینجا کنترل کنید، سپس
            ادامه دهید.
          </p>
          <NavButtons
            onPrev={goPrev}
            actionLabel="بروزرسانی"
            actionDisabled={!trId}
            busy={busy}
            onAction={async () => {
              if (!trId) return;
              setBusy(true);
              setError(null);
              try {
                await refreshReview(trId);
              } finally {
                setBusy(false);
              }
            }}
            nextLabel="ادامه"
            nextDisabled={!trId || payedRows <= 0}
            onNext={goNext}
          />
          <div>
            <div className="text-sm font-semibold mb-2">توزیع مبلغ</div>
            {busy && !moneyHist.length ? (
              <LoadingBlock label="بارگذاری توزیع مبلغ…" />
            ) : moneyHist.length ? (
              <FaDataTable
                columns={["cnt", "Money"]}
                columnTitles={{ cnt: "تعداد", Money: "مبلغ" }}
                rows={moneyHist.map((r) => ({
                  cnt: Number(r.cnt).toLocaleString("fa-IR"),
                  Money: Number(r.Money).toLocaleString("fa-IR"),
                }))}
                empty="—"
              />
            ) : (
              <p className="text-xs text-[var(--ink-soft)]">
                گزارشی یافت نشد — «بروزرسانی» را بزنید یا محاسبه را دوباره اجرا کنید.
              </p>
            )}
          </div>
        </div>
      ) : null}

      {step === "ibn" ? (
        <div className="panel p-5 space-y-4">
          <h2 className="font-[family-name:var(--font-display)] text-2xl">
            بررسی شباهای تکراری
          </h2>
          <p className="text-sm text-[var(--ink-soft)] leading-7">
            قبل از لیست پرداخت حق پرستاری و امداد، مطمئن شوید یک شماره حساب برای چند نفر
            تکرار نشده باشد؛ در غیر این صورت ممکن است به یک نفر بیش از یک‌بار پرداخت شود.
          </p>
          <NavButtons
            onPrev={goPrev}
            optional
            onSkip={skipOptional}
            actionLabel="بررسی شباهای تکراری"
            actionPrimary
            busy={busy}
            onAction={async () => {
              setBusy(true);
              setError(null);
              try {
                await loadIbnDup();
              } finally {
                setBusy(false);
              }
            }}
            nextLabel="ادامه"
            onNext={goNext}
          />
          {!ibnChecked ? (
            <p className="text-xs text-[var(--ink-soft)]">
              هنوز بررسی انجام نشده — دکمهٔ بالا را بزنید یا از مرحله رد شوید.
            </p>
          ) : ibnRows.length === 0 ? (
            <p className="text-sm text-[var(--brand)]">حساب تکراری یافت نشد.</p>
          ) : (
            <FaDataTable
              columns={Object.keys(ibnRows[0]!)}
              columnTitles={{ AccountNumber: "شماره حساب", dupCount: "تعداد تکرار" }}
              rows={ibnRows.slice((ibnPage - 1) * 10, ibnPage * 10)}
              empty="—"
              page={ibnPage}
              totalPages={Math.max(1, Math.ceil(ibnRows.length / 10))}
              total={ibnRows.length}
              onPageChange={setIbnPage}
            />
          )}
        </div>
      ) : null}

      {step === "payList" ? (
        <div className="panel p-5 space-y-4">
          <h2 className="font-[family-name:var(--font-display)] text-2xl">لیست پرداخت</h2>
          <p className="text-sm text-[var(--ink-soft)] leading-7">
            نمونهٔ فهرست پرداخت‌شوندگان با شبا.
          </p>
          <div className="flex flex-wrap items-center gap-2 w-full">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={listLoading}
              onClick={goPrev}
            >
              قبلی
            </button>
            <button
              type="button"
              className={`btn ${listActionActive === "load" ? "btn-primary" : "btn-ghost"}`}
              disabled={!trId || listLoading}
              onClick={() => {
                if (!trId) return;
                setListActionActive("load");
                void loadList(trId, 1, listPageSize);
              }}
            >
              {listLoading ? <LoadingSpinner size="sm" inline /> : null}
              بارگذاری لیست
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
              دانلود لیست
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={!trId || payedRows <= 0 || listLoading}
              onClick={() => {
                setListActionActive(null);
                goNext();
              }}
            >
              ادامه
            </button>
            <label className="text-sm flex items-center gap-2 ms-auto shrink-0">
              <span>تعداد در هر صفحه</span>
              <select
                className="btn btn-ghost"
                value={listPageSize}
                disabled={listLoading || !trId}
                onChange={(e) => {
                  const n = Number(e.target.value) || 10;
                  setListPageSize(n);
                  setListActionActive("load");
                  if (trId) void loadList(trId, 1, n);
                }}
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n.toLocaleString("fa-IR")}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <FaDataTable
            columns={listColumns}
            rows={listRows}
            empty="ردیفی نیست — «بارگذاری لیست» را بزنید"
            page={listPage}
            totalPages={listTotalPages}
            total={listTotal}
            loading={listLoading}
            onPageChange={(p) => {
              if (!trId) return;
              void loadList(trId, p, listPageSize);
            }}
          />
        </div>
      ) : null}

      {step === "pairSync" ? (
        <div className="panel p-5 space-y-4">
          <h2 className="font-[family-name:var(--font-display)] text-2xl">
            هم‌ترازی مستمری و افزایش
          </h2>
          <p className="text-sm text-[var(--ink-soft)] leading-7">
            اختیاری. افراد یا مبالغی که فقط در یکی از دو تراکنش هستند را ببینید. یکسان‌سازی
            نهایی پس از ساعت کاری و خارج از این صفحه انجام می‌شود.
          </p>
          <div className="field max-w-xs">
            <label htmlFor="peer-tr">شماره تراکنش جفت</label>
            <input
              id="peer-tr"
              dir="ltr"
              value={peerTrId}
              onChange={(e) => setPeerTrId(e.target.value.replace(/\D/g, ""))}
              placeholder="مثلاً 10628"
            />
          </div>
          <NavButtons
            onPrev={goPrev}
            optional
            onSkip={skipOptional}
            actionLabel="مقایسه"
            actionPrimary
            actionDisabled={!trId || !peerTrId}
            busy={busy}
            onAction={() => void runPairDiff()}
            nextLabel="ادامه"
            onNext={goNext}
          />
          {pairOnlyA.length || pairOnlyB.length || pairMoney.length ? (
            <div className="space-y-3">
              <div>
                <div className="text-sm font-semibold mb-1">فقط در #{trId}</div>
                <FaDataTable
                  columns={pairOnlyA[0] ? Object.keys(pairOnlyA[0]) : ["PersonId"]}
                  rows={pairOnlyA}
                  empty="—"
                />
              </div>
              <div>
                <div className="text-sm font-semibold mb-1">فقط در جفت</div>
                <FaDataTable
                  columns={pairOnlyB[0] ? Object.keys(pairOnlyB[0]) : ["PersonId"]}
                  rows={pairOnlyB}
                  empty="—"
                />
              </div>
              <div>
                <div className="text-sm font-semibold mb-1">مغایرت مبلغ</div>
                <FaDataTable
                  columns={pairMoney[0] ? Object.keys(pairMoney[0]) : ["NID"]}
                  rows={pairMoney}
                  empty="—"
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {step === "bankPrep" ? (
        <div className="panel p-5 space-y-4">
          <h2 className="font-[family-name:var(--font-display)] text-2xl">تهیه دیسکت بانک</h2>
          <p className="text-sm text-[var(--ink-soft)] leading-7">
            قالب ارمغان (<span dir="ltr">dbo.Export</span>): هر ردیف ۳۰ کاراکتر —
            <span dir="ltr" className="mx-1 font-mono text-xs">
              1 + Account(15) + Money(14)
            </span>
            . ابتدا فاقد شبا را بررسی کنید، سپس دیسکت را دانلود یا روی مسیر اشتراک ارمغان بنویسید.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy || exportBusy}
              onClick={goPrev}
            >
              قبلی
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy || exportBusy}
              onClick={() => {
                setBankActionActive(null);
                skipOptional();
              }}
            >
              رد شدن از مرحله اختیاری
            </button>
            <button
              type="button"
              className={`btn ${bankActionActive === "missing-ibn" ? "btn-primary" : "btn-ghost"}`}
              disabled={!trId || busy}
              onClick={async () => {
                setBankActionActive("missing-ibn");
                setMissingPage(1);
                await runMissingIbn();
              }}
            >
              {busy && bankActionActive === "missing-ibn" ? (
                <LoadingSpinner size="sm" inline />
              ) : null}
              نمایش فاقد شبا
            </button>
            <button
              type="button"
              className={`btn ${bankActionActive === "download" || bankModalOpen ? "btn-primary" : "btn-ghost"}`}
              disabled={!canDownloadDiskette || exportBusy || busy}
              title="دانلود فایل متنی هم‌قالب dbo.Export ارمغان"
              onClick={openBankModal}
            >
              {exportBusy && bankActionActive === "download" ? (
                <LoadingSpinner size="sm" inline />
              ) : null}
              دانلود دیسکت بانک
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy || exportBusy}
              onClick={() => {
                setBankActionActive(null);
                goNext();
              }}
            >
              ادامه
            </button>
          </div>
          {bankToken ? (
            <p className="text-xs text-[var(--brand)]" dir="ltr">
              FileName: {bankToken}
            </p>
          ) : null}
          {missingIbn.length ? (
            <FaDataTable
              columns={Object.keys(missingIbn[0]!)}
              rows={missingIbn.slice((missingPage - 1) * 10, missingPage * 10)}
              empty="—"
              page={missingPage}
              totalPages={Math.max(1, Math.ceil(missingIbn.length / 10))}
              total={missingIbn.length}
              onPageChange={setMissingPage}
            />
          ) : (
            <p className="text-xs text-[var(--ink-soft)]">
              هنوز نمونه‌ای بارگذاری نشده، یا فاقد شبا در این نمونه نیست.
            </p>
          )}
        </div>
      ) : null}

      {step === "approve" ? (
        <div className="panel p-5 space-y-4">
          <h2 className="font-[family-name:var(--font-display)] text-2xl">تایید پرداخت</h2>
          <div className="grid sm:grid-cols-2 gap-3 max-w-xl">
            <div className="field">
              <label htmlFor="mst-year">سال/ماه</label>
              <input
                id="mst-year"
                value={yearMonth}
                readOnly
                disabled
                placeholder={jalaliYearMonth()}
                dir="ltr"
              />
            </div>
            <div className="field">
              <label>نوع تایید</label>
              <div className="mt-2 text-sm font-semibold">
                {selectedType?.shortFa || "—"}
              </div>
            </div>
          </div>
          {approved ? (
            <p className="text-sm text-[var(--brand)]">این تراکنش قبلاً تایید شده است.</p>
          ) : null}
          {ky === "CANCELLED" ? (
            <p className="text-sm text-[var(--bad)]">این تراکنش کنسل‌شده علامت خورده است.</p>
          ) : null}
          <NavButtons
            onPrev={goPrev}
            actionLabel="تایید پرداخت این تراکنش"
            actionPrimary
            actionDisabled={!trId || !typeId || !labOk || yearMonth.length !== 6}
            busy={busy}
            onAction={async () => {
              if (!trId || !typeId) return;
              const data = await post({
                action: "approve",
                trId,
                typeId,
                yearMonth,
              });
              if (!data) return;
              setApproved(true);
              setKy(data.ky || selectedType?.ky || null);
              if (data.fileName) setBankToken(String(data.fileName));
              if (data.bankWarning) {
                setError(
                  `تایید انجام شد ولی دیسکت بانک روی مسیر ارمغان نوشته نشد: ${data.bankWarning}`,
                );
              }
              goNext();
            }}
            nextLabel="ادامه"
            nextDisabled={!approved}
            onNext={goNext}
          >
            <button
              type="button"
              className="btn btn-ghost text-[var(--bad)]"
              disabled={busy || !trId || !labOk}
              onClick={async () => {
                if (!trId) return;
                if (
                  !window.confirm(
                    "طبق سند عملیات: وقتی برای سقف بودجه دو تراکنش می‌سازید، تراکنش اول (لیست ناقص) را کنسل می‌کنید و لیست نهایی در تراکنش دوم می‌ماند. ادامه؟",
                  )
                ) {
                  return;
                }
                const data = await post({
                  action: "cancel",
                  trId,
                  typeId: typeId || "mst-base",
                });
                if (!data) return;
                setKy("CANCELLED");
                setApproved(false);
              }}
            >
              کنسل به‌خاطر سقف بودجه
            </button>
          </NavButtons>
        </div>
      ) : null}

      {step === "postPay" ? (
        <div className="panel p-5 space-y-4">
          <h2 className="font-[family-name:var(--font-display)] text-2xl">پس از پرداخت</h2>
          {isLastStep && isAdmin ? txnDoneStatus : null}
          <p className="text-sm text-[var(--ink-soft)] leading-7">
            کارهای پیگیری بعد از پرداخت در صفحات جداگانه انجام می‌شود. از اینجا می‌توانید
            مسیر را ببندید یا به فهرست برگردید.
          </p>
          <NavButtons
            onPrev={goPrev}
            homeHref="/?family=mostamari"
            homeLabel="بازگشت به فهرست مستمری"
            nextLabel="پایان"
            onNext={() => {
              setMsg("پایان مسیر مستمری");
              router.push("/?family=mostamari");
            }}
          />
          <div className="grid sm:grid-cols-2 gap-3">
            <Link
              href="/mostamari/returns"
              className="type-card text-right block no-underline text-inherit"
            >
              <div className="font-semibold">برگشتی‌ها</div>
              <div className="text-xs text-[var(--ink-soft)] mt-1 leading-5">
                ثبت مبالغ منفی پس از لیست برگشتی هدفمندی
              </div>
            </Link>
            <Link
              href="/settings/mostamari-rates"
              className="type-card text-right block no-underline text-inherit"
            >
              <div className="font-semibold">مبالغ و سقف سالانه</div>
              <div className="text-xs text-[var(--ink-soft)] mt-1 leading-5">
                به‌روزرسانی مبالغ و سقف استان‌ها در تنظیمات
              </div>
            </Link>
          </div>
        </div>
      ) : null}

      {bankModalOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mostamari-bank-export-title"
          onClick={() => !exportBusy && setBankModalOpen(false)}
        >
          <div
            className="w-full max-w-lg max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-xl border border-[var(--line)] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-[var(--line)] flex items-start justify-between gap-3">
              <div>
                <h2
                  id="mostamari-bank-export-title"
                  className="font-semibold text-lg"
                >
                  دانلود دیسکت بانک
                </h2>
                <p className="text-xs text-[var(--ink-soft)] mt-1">
                  تراکنش #{trId}
                  {payedRows > 0
                    ? ` · ${payedRows.toLocaleString("fa-IR")} ردیف محاسبه‌شده`
                    : ""}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost text-xs"
                disabled={exportBusy}
                onClick={() => setBankModalOpen(false)}
              >
                بستن
              </button>
            </div>

            <div className="p-4 overflow-auto space-y-4 text-sm">
              <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 space-y-1.5">
                <p className="text-xs font-semibold">قالب پیشنهادی (ارمغان)</p>
                <p className="text-xs leading-6 text-[var(--ink-soft)]">
                  همان خروجی <span dir="ltr">dbo.Export</span>: فایل متنی با ردیف‌های ۳۰
                  کاراکتری ثابت —
                  <span dir="ltr" className="font-mono mx-1">
                    1 + Account(15) + Money(14)
                  </span>
                  .
                </p>
                <p className="text-xs leading-6">
                  قالب پیشنهادی:{" "}
                  <span className="font-semibold">متن ارمغان (.txt)</span>
                  {" — "}
                  مناسب تحویل بانک / دانلود ارمغان
                </p>
              </div>

              <fieldset className="space-y-2">
                <legend className="font-semibold text-sm mb-1">قالب فایل</legend>
                <label className="flex items-start gap-2 rounded-xl border border-[var(--accent)] bg-[var(--paper)] px-3 py-2.5">
                  <input type="radio" className="mt-1" checked readOnly />
                  <span className="min-w-0">
                    <span className="font-medium">
                      متن ارمغان (.txt)
                      <span className="ms-2 text-[10px] text-[var(--accent)]">
                        پیشنهادی
                      </span>
                    </span>
                    <span className="block text-xs text-[var(--ink-soft)] leading-5 mt-0.5">
                      هم‌قالب BCP ارمغان؛ بدون هدر؛ قابل استفاده در مسیر Diskette
                    </span>
                  </span>
                </label>
              </fieldset>

              <div className="space-y-2">
                <p className="font-semibold text-sm">دانلود بر اساس شبا</p>
                <p className="text-xs text-[var(--ink-soft)] leading-5">
                  معمولاً «با شبا» برای دیسکت بانک استفاده می‌شود.
                </p>
              </div>
            </div>

            <div className="px-4 py-3 border-t border-[var(--line)] flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                {MOSTAMARI_EXPORT_IBN_SCOPES.map((scope) => (
                  <button
                    key={scope.id}
                    type="button"
                    className="btn btn-primary text-xs inline-flex items-center gap-1.5 flex-1 min-w-[8rem] justify-center"
                    disabled={exportBusy || !canDownloadDiskette}
                    title={scope.hintFa}
                    onClick={() => startBankDisketteDownload(scope.id)}
                  >
                    {exportBusy ? <LoadingSpinner size="sm" inline /> : null}
                    {scope.labelFa}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="btn btn-ghost text-xs self-end"
                disabled={exportBusy}
                onClick={() => setBankModalOpen(false)}
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {exportModalOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mostamari-export-title"
          onClick={() => !exportBusy && setExportModalOpen(false)}
        >
          <div
            className="w-full max-w-lg max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-xl border border-[var(--line)] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-[var(--line)] flex items-start justify-between gap-3">
              <div>
                <h2
                  id="mostamari-export-title"
                  className="font-semibold text-lg"
                >
                  دانلود لیست پرداخت
                </h2>
                <p className="text-xs text-[var(--ink-soft)] mt-1">
                  تعداد ردیف‌های لیست:{" "}
                  <span className="font-semibold text-[var(--ink)]">
                    {listCountBusy && !listTotalExact
                      ? "در حال شمارش…"
                      : listTotal.toLocaleString("fa-IR")}
                  </span>
                  {listTotalExact ? null : listCountBusy ? null : (
                    <span className="ms-1">(تقریبی تا پایان شمارش)</span>
                  )}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost text-xs"
                disabled={exportBusy}
                onClick={() => setExportModalOpen(false)}
              >
                بستن
              </button>
            </div>

            <div className="p-4 overflow-auto space-y-4 text-sm">
              <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 space-y-1.5">
                <p className="text-xs font-semibold">پیشنهاد بر اساس تعداد ردیف</p>
                <p className="text-xs leading-6 text-[var(--ink-soft)]">
                  {exportAdvice.reasonFa}
                </p>
                <p className="text-xs leading-6">
                  قالب پیشنهادی:{" "}
                  <span className="font-semibold">
                    {MOSTAMARI_EXPORT_FORMATS.find(
                      (f) => f.id === exportAdvice.format,
                    )?.labelFa || exportAdvice.format}
                  </span>
                  {" — "}
                  زمان تقریبی: {exportAdvice.etaFa}
                </p>
                <p className="text-xs leading-6 text-[var(--ink-soft)]">
                  {exportAdvice.waitTipFa}
                </p>
                <button
                  type="button"
                  className="btn btn-ghost text-xs mt-1"
                  onClick={() => setExportFormat(exportAdvice.format)}
                >
                  اعمال قالب پیشنهادی
                </button>
              </div>

              <fieldset className="space-y-2">
                <legend className="font-semibold text-sm mb-1">انتخاب قالب</legend>
                {MOSTAMARI_EXPORT_FORMATS.map((f) => {
                  const suggested = f.id === exportAdvice.format;
                  return (
                    <label
                      key={f.id}
                      className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 cursor-pointer ${
                        exportFormat === f.id
                          ? "border-[var(--accent)] bg-[var(--paper)]"
                          : "border-[var(--line)]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="mostamari-export-format"
                        className="mt-1"
                        checked={exportFormat === f.id}
                        onChange={() => setExportFormat(f.id)}
                      />
                      <span className="min-w-0">
                        <span className="font-medium">
                          {f.labelFa}
                          {suggested ? (
                            <span className="ms-2 text-[10px] text-[var(--accent)]">
                              پیشنهادی
                            </span>
                          ) : null}
                        </span>
                        <span className="block text-xs text-[var(--ink-soft)] leading-5 mt-0.5">
                          {f.hintFa}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </fieldset>

              <div className="space-y-2">
                <p className="font-semibold text-sm">دانلود بر اساس شبا</p>
                <p className="text-xs text-[var(--ink-soft)] leading-5">
                  قالب انتخاب‌شده برای هر سه خروجی استفاده می‌شود. یکی از دکمه‌ها را بزنید.
                </p>
              </div>
            </div>

            <div className="px-4 py-3 border-t border-[var(--line)] flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                {MOSTAMARI_EXPORT_IBN_SCOPES.map((scope) => (
                  <button
                    key={scope.id}
                    type="button"
                    className="btn btn-primary text-xs inline-flex items-center gap-1.5 flex-1 min-w-[8rem] justify-center"
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
              <button
                type="button"
                className="btn btn-ghost text-xs self-end"
                disabled={exportBusy}
                onClick={() => setExportModalOpen(false)}
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
