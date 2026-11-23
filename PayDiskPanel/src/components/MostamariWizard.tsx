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
import {
  isoToShamsi,
  jalaliYearMonth,
  jalaliYearMonthFromIso,
  JALALI_MONTHS_FA,
} from "@/lib/shamsi";
import {
  MOSTAMARI_OPS_LIST_COLS,
  MOSTAMARI_OPS_LIST_COL_FA,
} from "@/lib/mostamari/ops-list-cols";
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
  /** Disables controls (no spinner). Prefer actionBusy for action spinner only. */
  busy?: boolean;
  /** Spinner only on the action button — avoids fake loading on قبلی/ادامه. */
  actionBusy?: boolean;
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
  const locked = !!props.busy || !!props.actionBusy;
  const showActionSpinner = !!props.actionBusy;

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
          disabled={locked}
          onClick={props.onPrev}
        >
          قبلی
        </button>
      ) : null}
      {props.optional && props.onSkip ? (
        <button
          type="button"
          className="btn btn-ghost"
          disabled={locked}
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
          disabled={props.actionDisabled || locked}
          onClick={props.onAction}
        >
          {showActionSpinner ? <LoadingSpinner size="sm" inline /> : null}
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
          disabled={props.nextDisabled || locked}
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
  const urlStepRaw = (searchParams.get("step") || "").trim() as MostamariStepId | "";

  const inferredFromKy = inferMostamariTypeFromKy(urlKy)?.id || "";

  /** Prefer ?step=… so create→sayah survives URL remount; never default existing trId to calculate. */
  const [step, setStep] = useState<MostamariStepId>(() => {
    if (urlStepRaw) return urlStepRaw;
    return urlTrId ? "define" : "type";
  });
  const [typeId, setTypeId] = useState<MostamariTypeId | "">(
    urlType || inferredFromKy || "",
  );
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayIso());
  const [trId, setTrId] = useState<number | null>(urlTrId);
  const [yearMonth, setYearMonth] = useState(defaultYearMonth());
  const [peerTrId, setPeerTrId] = useState("");
  const [busy, setBusy] = useState(false);
  /** Panel-local work (e.g. سیاح) — locks step nav without hijacking other button spinners. */
  const [panelBusy, setPanelBusy] = useState(false);
  const [loadingTxn, setLoadingTxn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [labOk, setLabOk] = useState(false);
  /** PAYDISK_CALC_DRAFT — next calculate writes preview tables. */
  const [calcDraft, setCalcDraft] = useState(false);
  /** Where this txn’s current pay rows live (not the env flag). */
  const [paySource, setPaySource] = useState<"live" | "draft" | "none">("none");
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
  /** Peer txn with OLD saved rows — assert new SP dry-run vs that snapshot. */
  const [assertPeerTrId, setAssertPeerTrId] = useState("10801");
  const [assertBusy, setAssertBusy] = useState(false);
  const [assertError, setAssertError] = useState<string | null>(null);
  const [assertResult, setAssertResult] = useState<{
    messageFa?: string;
    noteFa?: string;
    driftNote?: string | null;
    allMatch?: boolean;
    coreSpMatchesSaved?: boolean;
    mismatchCount?: number;
    peerTrId?: number;
    peer?: {
      title?: string | null;
      ky?: string | null;
      typeTitleFa?: string | null;
    };
    diffs?: Array<{
      field: string;
      labelFa: string;
      newSp: string;
      saved: string;
      match: boolean;
    }>;
  } | null>(null);
  /** Draft ↔ live for this TrId (correct post-promote check). */
  const [draftCmpBusy, setDraftCmpBusy] = useState(false);
  const [draftCmpError, setDraftCmpError] = useState<string | null>(null);
  const [draftCmpResult, setDraftCmpResult] = useState<{
    messageFa?: string;
    noteFa?: string;
    allMatch?: boolean;
    diffs?: Array<{
      field: string;
      labelFa: string;
      draft: string;
      live: string;
      match: boolean;
    }>;
  } | null>(null);
  const [moneyHist, setMoneyHist] = useState<Array<{ cnt: number; Money: number }>>([]);
  const [aliveHist, setAliveHist] = useState<Array<{ cnt: number; Money: number }>>([]);
  const [familyMoneyReport, setFamilyMoneyReport] = useState<
    Array<{
      familyBucket: number;
      familyLabel: string;
      cnt: number;
      Money: number;
      totalMoney: number;
    }>
  >([]);
  const [familyAliveTotal, setFamilyAliveTotal] = useState(0);
  const [familyMoneyGrandTotal, setFamilyMoneyGrandTotal] = useState(0);
  /** Ops IsDead=0 filter for base-pension Excel report (slower). */
  const [familyAliveOnly, setFamilyAliveOnly] = useState(false);
  /** Calculate-step progress (SP is opaque — mix row probe + time estimate). */
  const [calcPct, setCalcPct] = useState(0);
  const [calcElapsed, setCalcElapsed] = useState(0);
  const [calcRows, setCalcRows] = useState<number | null>(null);
  const [calcRunning, setCalcRunning] = useState(false);
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
  /** Existing txn: type/title/date are fixed after create — no edit from step 1. */
  const txnCreated = !!trId;
  const defineFieldsLocked = txnCreated || payedRows > 0;
  /** Status/copy for rows already present — draft only if this txn’s rows are in Draft. */
  const hasDraftRows = paySource === "draft";
  const hasLiveRows = paySource === "live";
  /** Draft mode + live already written → calculate runs as dry-run (no Draft write). */
  const calcIsDryRunOnly = calcDraft && hasLiveRows;
  const alreadyCalculated =
    hasDraftRows || hasLiveRows || (!calcDraft && payedRows > 0);
  /** Block قبلی/ادامه/stepper while any long action runs — leaving the step aborts UX mid-flight. */
  const navLocked =
    busy ||
    calcRunning ||
    panelBusy ||
    listLoading ||
    exportBusy ||
    draftCmpBusy ||
    compareBusy ||
    assertBusy;

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

  async function runSpAssert() {
    if (!trId) return;
    const peer = Number(String(assertPeerTrId).replace(/\D/g, ""));
    if (!peer) {
      setAssertError("شماره تراکنش نمونه را وارد کنید (مثلاً ۱۰۸۰۱)");
      setCompareOpen(true);
      return;
    }
    setAssertBusy(true);
    setAssertError(null);
    setCompareOpen(true);
    try {
      const typeQ = typeId ? `&typeId=${encodeURIComponent(typeId)}` : "";
      const res = await fetch(
        `/api/wizard/mostamari?action=assert-sp&trId=${trId}&peerTrId=${peer}${typeQ}`,
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setAssertResult(null);
        setAssertError(data.message || "سنجش SP ناموفق");
        return;
      }
      setAssertResult(data);
    } catch {
      setAssertResult(null);
      setAssertError("خطای شبکه در سنجش SP");
    } finally {
      setAssertBusy(false);
    }
  }

  async function runDraftVsLive() {
    if (!trId) return;
    setDraftCmpBusy(true);
    setDraftCmpError(null);
    setCompareOpen(true);
    try {
      const res = await fetch(
        `/api/wizard/mostamari?action=compare-draft&trId=${trId}`,
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setDraftCmpResult(null);
        setDraftCmpError(data.message || "مقایسه پیش‌نویس ناموفق");
        return;
      }
      setDraftCmpResult(data);
    } catch {
      setDraftCmpResult(null);
      setDraftCmpError("خطای شبکه در مقایسه پیش‌نویس");
    } finally {
      setDraftCmpBusy(false);
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
            className="btn btn-primary text-xs"
            disabled={draftCmpBusy || !trId}
            onClick={() => void runDraftVsLive()}
          >
            {draftCmpBusy ? <LoadingSpinner size="sm" inline /> : null}
            مقایسه پیش‌نویس ↔ درج‌شده در DB
          </button>
          <span className="text-[11px] text-[var(--ink-soft)] leading-5 max-w-md">
            درست پس از تایید: Draft ↔ PayedContinusPayment همین تراکنش (تعداد/مبلغ/توزیع)
          </span>
        </div>
        <div className="flex flex-wrap gap-2 items-center border-t border-[var(--line)] pt-3">
          <button
            type="button"
            className="btn btn-ghost text-xs"
            disabled={compareBusy || !trId}
            onClick={() => void runCompare()}
          >
            {compareBusy ? <LoadingSpinner size="sm" inline /> : null}
            مقایسه با سند عملیات
          </button>
          <span className="text-[11px] text-[var(--ink-soft)]">
            کوئری پنل ↔ سند ops (بدون نوشتن)
          </span>
        </div>
        <div className="flex flex-wrap gap-2 items-end border-t border-[var(--line)] pt-3">
          <div className="field max-w-[9rem]">
            <label htmlFor="assert-peer-tr">تراکنش نمونه (اختیاری)</label>
            <input
              id="assert-peer-tr"
              dir="ltr"
              value={assertPeerTrId}
              onChange={(e) =>
                setAssertPeerTrId(e.target.value.replace(/\D/g, ""))
              }
              placeholder="10801"
            />
          </div>
          <button
            type="button"
            className="btn btn-ghost text-xs"
            disabled={assertBusy || !trId}
            onClick={() => void runSpAssert()}
          >
            {assertBusy ? <LoadingSpinner size="sm" inline /> : null}
            سنجش با تراکنش نمونه
          </button>
          <span className="text-[11px] text-[var(--ink-soft)] leading-5 max-w-md">
            اختیاری — dry-run ContinusPayment ↔ نمونهٔ قدیمی (نه جایگزین مقایسهٔ پیش‌نویس)
          </span>
        </div>
        {compareOpen ? (
          <div className="rounded-xl border border-[var(--line)] bg-white p-3 space-y-3 text-xs">
            {draftCmpError ? (
              <p className="text-[var(--bad)]">{draftCmpError}</p>
            ) : draftCmpBusy ? (
              <p className="text-[var(--ink-soft)]">در حال مقایسه پیش‌نویس ↔ زنده…</p>
            ) : draftCmpResult ? (
              <>
                <p
                  className={
                    draftCmpResult.allMatch
                      ? "text-[var(--brand)] font-semibold"
                      : "text-[var(--bad)] font-semibold"
                  }
                >
                  {draftCmpResult.messageFa}
                </p>
                {draftCmpResult.noteFa ? (
                  <p className="text-[var(--ink-soft)]">{draftCmpResult.noteFa}</p>
                ) : null}
                {(draftCmpResult.diffs || []).length > 0 ? (
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="text-right border-b border-[var(--line)]">
                        <th className="py-1">فیلد</th>
                        <th className="py-1">پیش‌نویس</th>
                        <th className="py-1">درج‌شده (live)</th>
                        <th className="py-1">وضعیت</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(draftCmpResult.diffs || []).map((d) => (
                        <tr key={d.field} className="border-b border-[var(--line)]">
                          <td className="py-1">{d.labelFa}</td>
                          <td className="py-1" dir="ltr">
                            {d.draft}
                          </td>
                          <td className="py-1" dir="ltr">
                            {d.live}
                          </td>
                          <td className="py-1">
                            {d.match ? "✓" : "✗"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
              </>
            ) : null}
            {compareError ? (
              <p className="text-[var(--bad)]">{compareError}</p>
            ) : compareBusy ? (
              <p className="text-[var(--ink-soft)]">در حال مقایسه با سند…</p>
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

            {assertError ? (
              <p className="text-[var(--bad)] border-t border-[var(--line)] pt-2">
                {assertError}
              </p>
            ) : assertBusy ? (
              <p className="text-[var(--ink-soft)] border-t border-[var(--line)] pt-2">
                در حال سنجش SP جدید با ذخیره‌شده…
              </p>
            ) : assertResult ? (
              <div className="border-t border-[var(--line)] pt-2 space-y-2">
                <p
                  className={
                    assertResult.coreSpMatchesSaved || assertResult.allMatch
                      ? "text-[var(--brand)] font-semibold"
                      : "text-[var(--accent)] font-semibold"
                  }
                >
                  {assertResult.messageFa}
                </p>
                <p className="text-[var(--ink-soft)]">
                  نمونه #{assertResult.peerTrId}
                  {assertResult.peer?.title
                    ? ` — ${assertResult.peer.title}`
                    : ""}
                  {assertResult.peer?.typeTitleFa
                    ? ` · ${assertResult.peer.typeTitleFa}`
                    : ""}
                  {assertResult.peer?.ky ? ` · Ky=${assertResult.peer.ky}` : ""}
                </p>
                {assertResult.noteFa ? (
                  <p className="text-[var(--ink-soft)] leading-5">
                    {assertResult.noteFa}
                  </p>
                ) : null}
                {assertResult.driftNote ? (
                  <p className="text-[#a15c00] leading-5">
                    {assertResult.driftNote}
                  </p>
                ) : null}
                <div className="overflow-auto">
                  <table className="data text-xs w-full">
                    <thead>
                      <tr>
                        <th>فیلد</th>
                        <th>SP جدید / جاری</th>
                        <th>ذخیره‌شده نمونه</th>
                        <th>نتیجه</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(assertResult.diffs || []).map((d) => (
                        <tr key={d.field}>
                          <td>{d.labelFa}</td>
                          <td className="wrap" dir="ltr">
                            {d.newSp}
                          </td>
                          <td className="wrap" dir="ltr">
                            {d.saved}
                          </td>
                          <td>{d.match ? "✓" : "≠"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
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
    if (navLocked) return;
    const n = nextPipelineStep(pipeline, step);
    if (n) setStep(n);
  }
  function goPrev() {
    if (navLocked) return;
    let p = prevPipelineStep(pipeline, step);
    // Existing txn: skip locked type step when going back.
    if (p === "type" && txnCreated) {
      p = prevPipelineStep(pipeline, "type");
    }
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
        if (typeof data.calcDraft === "boolean") setCalcDraft(!!data.calcDraft);
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
      setPaySource(
        h.paySource === "draft" || h.paySource === "live" || h.paySource === "none"
          ? h.paySource
          : Number(h.payedRows || 0) > 0
            ? "live"
            : "none",
      );
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
      if (typeof data.calcDraft === "boolean") setCalcDraft(!!data.calcDraft);
      setDb(data.dbLabel || "");
      setMsg(
        fromHeader || fromTitle
          ? `تراکنش مستمری #${h.Id}`
          : `تراکنش مستمری #${h.Id} — نوع را دستی انتخاب کنید`,
      );
      // Existing txn: never stay on type (type is fixed at create).
      // Calculated: also skip define → calculate. Leave sayahMatch alone.
      const rows = Number(h.payedRows || 0);
      setStep((s) => {
        if (s === "type") return rows > 0 ? "calculate" : "define";
        if (rows > 0 && s === "define") return "calculate";
        return s;
      });
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
    if (trId && step === "type") {
      setStep(payedRows > 0 ? "calculate" : "define");
      return;
    }
    if (!pipeline.some((s) => s.id === step)) {
      // Prefer define (then sayah) over jumping straight to calculate.
      setStep(trId ? "define" : "type");
    }
  }, [pipeline, step, trId, payedRows]);

  /** Clear progress chrome when leaving calculate — avoids looking like a re-run. */
  useEffect(() => {
    if (step === "calculate" || calcRunning) return;
    setCalcPct(0);
    setCalcElapsed(0);
    setCalcRows(null);
  }, [step, calcRunning]);

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

  async function refreshReview(id: number, aliveOnly = familyAliveOnly) {
    // Default: fast GROUP BY Money (no Person join). alive=1 = ops IsDead=0 (slower).
    const aliveQ = aliveOnly ? "&alive=1" : "";
    const res = await fetch(
      `/api/wizard/mostamari?action=review&trId=${id}&page=1&pageSize=10${aliveQ}`,
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      setError((data as { message?: string }).message || "گزارش مبلغ ناموفق");
      return false;
    }
    setPayedRows(Number(data.total || 0));
    setMoneyHist(Array.isArray(data.moneyHistogram) ? data.moneyHistogram : []);
    setAliveHist(Array.isArray(data.aliveHistogram) ? data.aliveHistogram : []);
    setFamilyMoneyReport(
      Array.isArray(data.familyMoneyReport) ? data.familyMoneyReport : [],
    );
    setFamilyAliveTotal(Number(data.familyAliveTotal || 0));
    setFamilyMoneyGrandTotal(Number(data.familyMoneyGrandTotal || 0));
    setFamilyAliveOnly(!!data.familyReportAliveOnly);
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
    if (listRows.length) {
      const keys = Object.keys(listRows[0]!);
      const ordered = MOSTAMARI_OPS_LIST_COLS.filter((c) => keys.includes(c));
      const extra = keys.filter(
        (k) => !(MOSTAMARI_OPS_LIST_COLS as readonly string[]).includes(k),
      );
      return [...ordered, ...extra];
    }
    return [...MOSTAMARI_OPS_LIST_COLS];
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
          // Created txn: type is locked — don't reopen step 1 for editing.
          const typeLocked = txnCreated && s.id === "type";
          const stepNavBlocked = typeLocked || navLocked;
          return (
            <button
              key={s.id}
              type="button"
              className={`stepper-item ${active ? "is-active" : ""} ${done || typeLocked ? "is-done" : ""}`}
              title={
                typeLocked
                  ? "نوع تراکنش پس از ثبت قابل تغییر نیست"
                  : navLocked
                    ? "تا پایان عملیات جاری نمی‌توانید مرحله را عوض کنید"
                    : s.hintFa || s.hintEn || s.label
              }
              disabled={stepNavBlocked}
              onClick={() => {
                if (stepNavBlocked) return;
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
              searchable={!txnCreated}
              searchPlaceholder="جستجوی نوع مستمری…"
              placeholder="یک نوع را انتخاب کنید"
              value={typeId || ""}
              disabled={txnCreated}
              options={MOSTAMARI_TYPES.map((t) => ({
                value: t.id,
                label: t.shortFa,
                title: t.titleFa,
              }))}
              onChange={(v) => {
                if (txnCreated) return;
                setTypeId(v as MostamariTypeId);
                setSkipped({});
              }}
            />
          </div>
          {txnCreated ? (
            <p className="text-xs text-[var(--ink-soft)]">
              تراکنش #{trId} قبلاً ثبت شده — نوع قابل تغییر نیست. برای کار روی این تراکنش از
              مراحل بعدی استفاده کنید.
            </p>
          ) : null}
          <NavButtons
            busy={navLocked}
            nextDisabled={!typeId}
            nextLabel={txnCreated ? "ادامه" : undefined}
            onNext={() => {
              if (navLocked) return;
              if (txnCreated) {
                setStep(payedRows > 0 ? "calculate" : "define");
                return;
              }
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
            onPrev={txnCreated ? undefined : goPrev}
            nextLabel={trId ? "ادامه" : "ثبت تراکنش"}
            nextDisabled={busy || (!trId && (!title.trim() || !labOk))}
            busy={navLocked}
            actionBusy={busy && !trId}
            onNext={async () => {
              if (trId) {
                goNext();
                return;
              }
              const data = await post({ action: "create", title, date, typeId });
              if (!data) return;
              const newId = Number(data.trId);
              setTrId(newId);
              setStep("sayahMatch");
              // step=sayahMatch in URL so remount after replace does not skip تطبیق شبا
              router.replace(
                `/request/new?family=mostamari&trId=${newId}&type=${typeId}&step=sayahMatch`,
              );
            }}
          />
        </div>
      ) : null}

      {step === "sayahMatch" ? (
        <SayahMatchPanel
          scope={payedRows > 0 && trId ? "mostamari-pay" : "mostamari-ibn"}
          trId={trId}
          isAdmin={isAdmin}
          busy={navLocked}
          onBusy={setPanelBusy}
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
              {calcDraft
                ? `محاسبهٔ پیش‌نویس «${selectedType?.shortFa}» برای #${trId} فقط جدول Draft را پر می‌کند؛ ردیف زندهٔ Payed* تا تایید تغییر نمی‌کند.`
                : `محاسبهٔ «${selectedType?.shortFa}» برای تراکنش #${trId} روی سرور SQL اجرا می‌شود.`}{" "}
              پیشرفت تقریبی است — صفحه را نبندید.
            </p>
          )}
          <div className="text-sm">
            وضعیت محاسبه:{" "}
            <strong>
              {calcRunning
                ? "در حال اجرا…"
                : payedRows > 0
                  ? hasDraftRows
                    ? "پیش‌نویس آماده — می‌توانید به گزارش بروید"
                    : "انجام شده — می‌توانید به گزارش بروید"
                  : "هنوز محاسبه نشده"}
            </strong>
          </div>
          {calcIsDryRunOnly && !calcRunning ? (
            <div className="rounded-xl bg-[#fff8e6] text-[#8a6d1d] px-4 py-3 text-sm">
              Live از قبل نوشته شده — «محاسبه» فقط به‌صورت خواندنی اجرا می‌شود (نتیجهٔ امروز
              در برابر live) و در Draft چیزی ذخیره نمی‌شود. برای نوشتن پیش‌نویس واقعی یک
              تراکنش تازه بسازید.
            </div>
          ) : null}
          {payedRows > 0 && !calcRunning && !calcIsDryRunOnly ? (
            <div className="rounded-xl bg-[#e8f4ee] text-[#1f7a4d] px-4 py-3 text-sm">
              {hasDraftRows
                ? "پیش‌نویس قبلاً ساخته شده. ادامه دهید یا در صورت نیاز «محاسبه مجدد» را بزنید (فقط Draft پاک و دوباره پر می‌شود)."
                : "این تراکنش قبلاً محاسبه شده است. ادامه دهید یا در صورت نیاز «محاسبه مجدد» را بزنید."}
            </div>
          ) : null}
          {calcRunning ? (
            <div className="space-y-2 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  پیشرفت تقریبی:{" "}
                  <strong dir="ltr">
                    {Math.round(calcPct).toLocaleString("fa-IR")}٪
                  </strong>
                </span>
                <span className="text-[var(--ink-soft)]" dir="ltr">
                  {Math.floor(calcElapsed / 60)}:
                  {String(calcElapsed % 60).padStart(2, "0")}
                  {calcRows != null
                    ? ` · ${calcRows.toLocaleString("fa-IR")} ردیف`
                    : ""}
                </span>
              </div>
              <div
                className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--line)]"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(calcPct)}
              >
                <div
                  className="h-full rounded-full bg-[var(--brand)] transition-[width] duration-500 ease-out"
                  style={{ width: `${Math.min(100, Math.max(0, calcPct))}%` }}
                />
              </div>
              <p className="text-[11px] text-[var(--ink-soft)] leading-5">
                درصد واقعی از داخل SP در دسترس نیست؛ اگر ردیف‌ها رشد کنند از آن‌ها
                استفاده می‌شود، وگرنه بر اساس زمان تخمینی پیش می‌رود.
              </p>
            </div>
          ) : null}
          {!sayahGateOk && !skipped.sayahMatch && payedRows <= 0 ? (
            <div className="rounded-xl bg-[#fff8e6] text-[#8a6d1d] px-4 py-3 text-sm">
              ابتدا مرحلهٔ «تطبیق شبا» را با موفقیت انجام دهید (یا از آن مرحله برگردید).
            </div>
          ) : null}
          <NavButtons
            onPrev={goPrev}
            actionLabel={alreadyCalculated ? "محاسبه مجدد" : "محاسبه"}
            actionPrimary
            actionDisabled={
              !trId ||
              !typeId ||
              !labOk ||
              calcRunning ||
              (!sayahGateOk &&
                !skipped.sayahMatch &&
                !alreadyCalculated &&
                payedRows <= 0)
            }
            busy={navLocked}
            actionBusy={calcRunning || busy}
            onAction={async () => {
              if (!trId || !typeId) return;
              if (alreadyCalculated) {
                const ok = window.confirm(
                  calcIsDryRunOnly
                    ? "Live از قبل پر است. محاسبه فقط خواندنی است و Draft نوشته نمی‌شود — نتیجهٔ امروز با live مقایسه می‌شود. ادامه؟"
                    : calcDraft
                      ? "پیش‌نویس قبلاً ساخته شده. محاسبه مجدد فقط جدول Draft را پاک و دوباره پر می‌کند. ادامه؟"
                      : approved
                        ? "این تراکنش تایید شده است. محاسبه مجدد، ردیف‌های فعلی را پاک و دوباره می‌سازد. ادامه؟"
                        : "محاسبه قبلاً انجام شده. محاسبه مجدد ردیف‌ها را دوباره می‌سازد. ادامه؟",
                );
                if (!ok) return;
              }
              const expectedRows =
                typeId === "mst-base" || typeId === "mst-hadafmandi"
                  ? 1_600_000
                  : typeId === "mst-emdad"
                    ? 80_000
                    : 50_000;
              const expectedSec =
                typeId === "mst-base" || typeId === "mst-hadafmandi" ? 90 : 60;
              setCalcRunning(true);
              setCalcPct(1);
              setCalcElapsed(0);
              setCalcRows(null);
              setError(null);
              setMsg(null);
              const started = Date.now();
              const tick = window.setInterval(() => {
                const elapsed = Math.floor((Date.now() - started) / 1000);
                setCalcElapsed(elapsed);
                setCalcPct((prev) => {
                  const timePct =
                    95 * (1 - Math.exp(-elapsed / Math.max(30, expectedSec)));
                  return Math.max(prev, Math.min(95, timePct));
                });
              }, 1000);
              const poll = window.setInterval(() => {
                void (async () => {
                  try {
                    const res = await fetch(
                      `/api/wizard/mostamari?action=calc-progress&trId=${trId}`,
                    );
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok || !data.ok || data.rows == null) return;
                    const rows = Number(data.rows);
                    if (!Number.isFinite(rows)) return;
                    setCalcRows(rows);
                    const rowPct = Math.min(
                      95,
                      (rows / Math.max(1, expectedRows)) * 100,
                    );
                    setCalcPct((prev) => Math.max(prev, rowPct));
                  } catch {
                    /* ignore probe errors while SP holds locks */
                  }
                })();
              }, 4000);
              try {
                const data = await post({
                  action: "calculate",
                  trId,
                  typeId,
                });
                if (!data) return;
                setPayedRows(Number(data.payedRows || 0) > 0 ? 1 : 0);
                if (
                  data.paySource === "draft" ||
                  data.paySource === "live" ||
                  data.paySource === "none"
                ) {
                  setPaySource(data.paySource);
                } else if (Number(data.payedRows || 0) > 0) {
                  setPaySource(data.draft ? "draft" : "live");
                }
                setCalcPct(100);
                if (data.ms != null) {
                  setCalcElapsed(Math.round(Number(data.ms) / 1000));
                }
                setMsg(
                  data.message ||
                    "محاسبه تمام شد — برای گزارش، «ادامه» را بزنید سپس بروزرسانی.",
                );
              } finally {
                window.clearInterval(tick);
                window.clearInterval(poll);
                setCalcRunning(false);
              }
            }}
            nextLabel="ادامه"
            nextDisabled={payedRows <= 0 || calcRunning}
            onNext={goNext}
          />
        </div>
      ) : null}

      {step === "report" ? (
        <div className="panel p-5 space-y-4">
          <h2 className="font-[family-name:var(--font-display)] text-2xl">
            پیش‌نویس گزارش مبلغ
          </h2>
          <p className="text-sm text-[var(--ink-soft)] leading-7">
            {typeId === "mst-base"
              ? "قالب اکسل عملیات: یک ردیف به ازای هر مبلغ؛ برچسب بعد خانوار از جدول تعریف مبلغ. گزارش خودکار بارگذاری نمی‌شود — «بروزرسانی» را بزنید."
              : "خلاصهٔ تعداد افراد به تفکیک مبلغ. برای بارگذاری گزارش، «بروزرسانی» را بزنید."}
          </p>
          <NavButtons
            onPrev={goPrev}
            actionLabel="بروزرسانی"
            actionPrimary={!familyMoneyReport.length && !moneyHist.length}
            actionDisabled={!trId}
            busy={navLocked}
            actionBusy={busy}
            onAction={async () => {
              if (!trId) return;
              setBusy(true);
              setError(null);
              try {
                await refreshReview(trId, familyAliveOnly);
              } finally {
                setBusy(false);
              }
            }}
            nextLabel="ادامه"
            nextDisabled={!trId || payedRows <= 0}
            onNext={goNext}
          />
          <div>
            {typeId === "mst-base" ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="text-sm font-semibold text-center flex-1">
                    {(() => {
                      const shamsi = isoToShamsi(date);
                      if (!shamsi) return "گزارش مستمری";
                      const month =
                        JALALI_MONTHS_FA[shamsi.jm - 1] || String(shamsi.jm);
                      const yearFa = String(shamsi.jy).replace(
                        /\d/g,
                        (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]!,
                      );
                      return `گزارش مستمری ${month} ${yearFa}`;
                    })()}
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs text-[var(--ink-soft)] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={familyAliveOnly}
                      disabled={busy || !trId}
                      onChange={async (e) => {
                        const next = e.target.checked;
                        setFamilyAliveOnly(next);
                        if (!trId || !familyMoneyReport.length) return;
                        setBusy(true);
                        setError(null);
                        try {
                          await refreshReview(trId, next);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    />
                    فقط زنده‌ها (IsDead=۰) — کندتر
                  </label>
                </div>
                <p className="text-[11px] text-[var(--ink-soft)] mb-2">
                  {familyMoneyReport.length
                    ? familyAliveOnly
                      ? "فیلتر زنده‌ها فعال است (اسکریپت عملیات)."
                      : "حالت سریع: همه ردیف‌های تراکنش، بدون جوین Person."
                    : "هنوز گزارشی بارگذاری نشده — «بروزرسانی» را بزنید."}
                </p>
                {busy && !familyMoneyReport.length ? (
                  <LoadingBlock label="بارگذاری گزارش مستمری…" />
                ) : familyMoneyReport.length ? (
                  <div className="requests-table w-full border border-[var(--line)] rounded-xl overflow-x-auto">
                    <table className="data">
                      <thead>
                        <tr>
                          <th>ردیف</th>
                          <th>بعد خانوار</th>
                          <th>تعداد</th>
                          <th>مبلغ</th>
                          <th>جمع</th>
                        </tr>
                      </thead>
                      <tbody>
                        {familyMoneyReport.map((r, i) => (
                          <tr key={`${r.familyBucket}-${r.Money}-${i}`}>
                            <td>{(i + 1).toLocaleString("fa-IR")}</td>
                            <td>{r.familyLabel}</td>
                            <td dir="ltr">
                              {r.cnt.toLocaleString("fa-IR")}
                            </td>
                            <td dir="ltr">
                              {r.Money.toLocaleString("fa-IR")}
                            </td>
                            <td dir="ltr">
                              {r.totalMoney.toLocaleString("fa-IR")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="font-semibold border-t border-[var(--line)]">
                          <td>جمع</td>
                          <td />
                          <td dir="ltr">
                            {familyAliveTotal.toLocaleString("fa-IR")}
                          </td>
                          <td />
                          <td dir="ltr">
                            {familyMoneyGrandTotal.toLocaleString("fa-IR")}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--ink-soft)]">
                    گزارشی یافت نشد — «بروزرسانی» را بزنید یا محاسبه را دوباره اجرا
                    کنید.
                  </p>
                )}
              </>
            ) : (
              <>
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
                    گزارشی یافت نشد — «بروزرسانی» را بزنید یا محاسبه را دوباره اجرا
                    کنید.
                  </p>
                )}
              </>
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
            busy={navLocked}
            actionBusy={busy}
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
            تهیه لیست مستمری‌بگیران (قالب سند عملیات): ستون‌هایی مثل{" "}
            <span dir="ltr">NIDMadadjo</span>، <span dir="ltr">sheba</span>،{" "}
            <span dir="ltr">Marhale</span>، <span dir="ltr">khanevar_dim</span> — همان
            هدرهای فایل CSV دانلود.
          </p>
          <div className="flex flex-wrap items-center gap-2 w-full">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={navLocked}
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
              disabled={!trId || payedRows <= 0 || navLocked}
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
            columnTitles={{ ...MOSTAMARI_OPS_LIST_COL_FA }}
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
            busy={navLocked}
            actionBusy={busy}
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
              disabled={navLocked}
              onClick={goPrev}
            >
              قبلی
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={navLocked}
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
              disabled={navLocked}
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
          {!approved &&
          ky !== "CANCELLED" &&
          !hasDraftRows &&
          !hasLiveRows &&
          payedRows <= 0 ? (
            <p className="text-sm text-[#8a6d1d] bg-[#fff8e6] rounded-xl px-4 py-3">
              هنوز محاسبه‌ای نوشته نشده — اول مرحلهٔ «محاسبه» را کامل کنید؛ تا آن زمان تایید
              غیرفعال است.
            </p>
          ) : null}
          {calcDraft && hasLiveRows && !hasDraftRows && !approved ? (
            <p className="text-xs text-[var(--ink-soft)] leading-5">
              پیش‌نویس خالی است و فقط live موجود است — تایید فقط Ky/Year را می‌زند (ارتقا
              پیش‌نویس لازم نیست). برای پیش‌نویس جدید تراکنش تازه بسازید.
            </p>
          ) : null}
          <NavButtons
            onPrev={goPrev}
            actionLabel="تایید پرداخت این تراکنش"
            actionPrimary
            actionDisabled={
              !trId ||
              !typeId ||
              !labOk ||
              yearMonth.length !== 6 ||
              approved ||
              ky === "CANCELLED" ||
              (calcDraft
                ? !hasDraftRows && !hasLiveRows
                : payedRows <= 0)
            }
            busy={navLocked}
            actionBusy={busy}
            onAction={async () => {
              if (!trId || !typeId) return;
              if (approved || ky === "CANCELLED") return;
              if (calcDraft ? !hasDraftRows && !hasLiveRows : payedRows <= 0) {
                setError("قبل از تایید باید محاسبه نوشته شده باشد.");
                return;
              }
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
          {isLastStep ? txnDoneStatus : null}
          <p className="text-sm text-[var(--ink-soft)] leading-7">
            کارهای پیگیری بعد از پرداخت در صفحات جداگانه انجام می‌شود. از اینجا می‌توانید
            مسیر را ببندید یا به فهرست برگردید.
          </p>
          <NavButtons
            onPrev={goPrev}
            busy={navLocked}
            homeHref="/?family=mostamari"
            homeLabel="بازگشت به فهرست مستمری"
            nextLabel="پایان"
            onNext={() => {
              if (navLocked) return;
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
