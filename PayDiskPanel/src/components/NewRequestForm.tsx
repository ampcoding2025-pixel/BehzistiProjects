"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UI_CALC_TYPES } from "@/lib/armaghan";
import { DISK_CATALOG, getDiskType } from "@/lib/catalog";
import { ACTIVE_SUPPLY_LOCATIONS } from "@/lib/supply-locations";
import type { DiskFamily, DiskRequest, MakeOverUiType } from "@/lib/types";
import { columnTitleFa } from "@/lib/reports/columns-fa";

type WizardStep = {
  id: string;
  label: string;
  armaghan: string;
};

const YARANE_STEPS: WizardStep[] = [
  { id: "txn", label: "تراکنش", armaghan: "دکمه جدید" },
  { id: "type", label: "نوع محاسبه", armaghan: "مودال نوع محاسبه" },
  { id: "calc", label: "اجرای محاسبه", armaghan: "کلید محاسبه" },
  { id: "list", label: "لیست افراد", armaghan: "تهیه لیست افراد" },
  { id: "manager", label: "گزارش و اقدام", armaghan: "تحویل به مالی" },
];

const MOSTAMARI_STEPS: WizardStep[] = [
  { id: "txn", label: "نوع و تراکنش", armaghan: "انتخاب نوع مستمری" },
  { id: "calc", label: "اجرای محاسبه", armaghan: "Calculate*" },
  { id: "excel", label: "تهیه اکسل", armaghan: "خروجی پرداخت" },
  { id: "manager", label: "گزارش و اقدام", armaghan: "دانلود / تایید" },
];

const CALC_TYPES = UI_CALC_TYPES.filter(
  (t) => t.value !== "list" && t.value !== "diskette",
);

function defaultDiskForUiType(type: MakeOverUiType) {
  return (
    DISK_CATALOG.find((d) => d.family === "yarane" && d.id.startsWith("yrn-ui-") && d.makeOverType === type)?.id ||
    DISK_CATALOG.find((d) => d.family === "yarane" && d.makeOverType === type)?.id ||
    "yrn-ui-roozane"
  );
}

function cell(v: unknown) {
  if (v == null) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function NewRequestForm() {
  const router = useRouter();
  const [family, setFamily] = useState<DiskFamily>("yarane");
  const [stepIdx, setStepIdx] = useState(0);

  const [title, setTitle] = useState("");
  const [period, setPeriod] = useState("");
  const [existingTrId, setExistingTrId] = useState("");
  const [makeOverType, setMakeOverType] = useState<MakeOverUiType>("roozane");
  const [supplyLocationId, setSupplyLocationId] = useState<number>(9);
  const [diskTypeId, setDiskTypeId] = useState("yrn-ui-roozane");
  const [supplyFilter, setSupplyFilter] = useState("");

  const [request, setRequest] = useState<DiskRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastStepMsg, setLastStepMsg] = useState<string | null>(null);
  const [reportRows, setReportRows] = useState<Record<string, unknown>[] | null>(null);
  const [reportCols, setReportCols] = useState<string[]>([]);
  const [reportTitle, setReportTitle] = useState("");

  const steps = family === "yarane" ? YARANE_STEPS : MOSTAMARI_STEPS;
  const step = steps[stepIdx];
  const disk = getDiskType(diskTypeId);

  const mostamariTypes = useMemo(
    () => DISK_CATALOG.filter((d) => d.family === "mostamari"),
    [],
  );

  const filteredSupply = useMemo(() => {
    const q = supplyFilter.trim().toLowerCase();
    if (!q) return ACTIVE_SUPPLY_LOCATIONS;
    return ACTIVE_SUPPLY_LOCATIONS.filter(
      (s) =>
        s.titleFa.toLowerCase().includes(q) ||
        String(s.id).includes(q) ||
        (s.keyword || "").toLowerCase().includes(q),
    );
  }, [supplyFilter]);

  function resetWizard(nextFamily: DiskFamily) {
    setFamily(nextFamily);
    setStepIdx(0);
    setRequest(null);
    setError(null);
    setLastStepMsg(null);
    setReportRows(null);
    setReportCols([]);
    setReportTitle("");
    if (nextFamily === "yarane") {
      setDiskTypeId("yrn-ui-roozane");
      setMakeOverType("roozane");
      setSupplyLocationId(9);
    } else {
      setDiskTypeId(mostamariTypes[0]?.id || "mst-base");
    }
  }

  async function createDraft() {
    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        diskTypeId,
        title,
        periodLabel: period,
        armaghanTransactionId: existingTrId || undefined,
        makeOverType: family === "yarane" ? makeOverType : undefined,
        supplyLocationId: family === "yarane" ? supplyLocationId : undefined,
        pipeline: true,
        runNow: false,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.message || "ایجاد درخواست ناموفق");
    setRequest(data.request);
    return data.request as DiskRequest;
  }

  async function runAction(
    action: string,
    reqId?: string,
    extra?: Record<string, unknown>,
  ) {
    const id = reqId || request?.id;
    if (!id) throw new Error("درخواست هنوز ساخته نشده");
    const res = await fetch(`/api/requests/${id}/pipeline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        diskTypeId,
        makeOverType: family === "yarane" ? makeOverType : undefined,
        supplyLocationId: family === "yarane" ? supplyLocationId : undefined,
        ...extra,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.message || "اجرای مرحله ناموفق");
    setRequest(data.request);
    const tail = (data.request.logTail || []) as string[];
    setLastStepMsg(tail[tail.length - 1] || "انجام شد");
    return data.request as DiskRequest;
  }

  async function loadManagerReport() {
    const reportId =
      family === "yarane" ? "yarane-pipeline-summary" : "mostamari-ky-distribution";
    const res = await fetch(`/api/reports/${reportId}`);
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setReportRows([]);
      setReportCols([]);
      setReportTitle("گزارش در دسترس نیست");
      return;
    }
    setReportTitle(data.result.label || reportId);
    setReportCols(data.result.columns || []);
    setReportRows(data.result.rows || []);
  }

  async function goNext() {
    setError(null);
    setBusy(true);
    try {
      if (family === "yarane") {
        if (step.id === "txn") {
          if (!title.trim() || !period.trim()) {
            setError("عنوان و دوره مثل prompt ارمغان الزامی است.");
            return;
          }
          // type may still be default; allow advancing after register
          let row = request;
          if (!row) row = await createDraft();
          await runAction("register", row.id);
          setStepIdx(1);
          return;
        }
        if (step.id === "type") {
          if (!makeOverType) {
            setError("نوع محاسبه را انتخاب کنید.");
            return;
          }
          const mapped = defaultDiskForUiType(makeOverType);
          // Prefer supply-specific catalog id when user picked a location card
          const supplyDisk = DISK_CATALOG.find(
            (d) => d.id === `yrn-sl-${supplyLocationId}`,
          );
          setDiskTypeId(supplyDisk?.id || mapped);
          if (request) {
            await fetch(`/api/requests/${request.id}/pipeline`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "register",
                diskTypeId: supplyDisk?.id || mapped,
                makeOverType,
                supplyLocationId,
              }),
            }).then(async (r) => {
              const d = await r.json();
              if (d.ok) setRequest(d.request);
            });
          }
          setStepIdx(2);
          return;
        }
        if (step.id === "calc") {
          await runAction("calculate");
          setStepIdx(3);
          return;
        }
        if (step.id === "list") {
          await runAction("list");
          await loadManagerReport();
          setStepIdx(4);
          return;
        }
      } else {
        if (step.id === "txn") {
          if (!title.trim() || !period.trim() || !existingTrId.trim()) {
            setError("برای مستمری: عنوان، دوره و شناسه تراکنش الزامی است.");
            return;
          }
          let row = request;
          if (!row) row = await createDraft();
          await runAction("register", row.id);
          setStepIdx(1);
          return;
        }
        if (step.id === "calc") {
          await runAction("calculate");
          setStepIdx(2);
          return;
        }
        if (step.id === "excel") {
          await runAction("excel");
          await loadManagerReport();
          setStepIdx(3);
          return;
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function managerAction(action: "handoff_finance" | "diskette" | "mark_ready") {
    setBusy(true);
    setError(null);
    try {
      await runAction(action);
      if (action === "handoff_finance" || action === "diskette" || action === "mark_ready") {
        setTimeout(() => router.push("/"), 700);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel p-5 md:p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`btn text-xs ${family === "yarane" ? "btn-primary" : "btn-ghost"}`}
          onClick={() => resetWizard("yarane")}
          disabled={busy}
        >
          مسیر یارانه (ارمغان)
        </button>
        <button
          type="button"
          className={`btn text-xs ${family === "mostamari" ? "btn-primary" : "btn-ghost"}`}
          onClick={() => resetWizard("mostamari")}
          disabled={busy}
        >
          مسیر مستمری
        </button>
      </div>

      <nav
        className="stepper"
        style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
        aria-label="مراحل مطابق ارمغان"
      >
        {steps.map((s, i) => {
          const state = stepIdx === i ? "is-active" : stepIdx > i ? "is-done" : "";
          return (
            <div key={s.id} className={`stepper-item ${state}`}>
              <div className="stepper-dot">{stepIdx > i ? "✓" : i + 1}</div>
              <div className="stepper-label">
                <div>{s.label}</div>
                <div className="font-normal opacity-80 text-[10px] mt-0.5">{s.armaghan}</div>
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-[var(--line)] pt-5 space-y-4">
        {step.id === "txn" && family === "yarane" ? (
          <>
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-2xl">تراکنش جدید</h2>
              <p className="text-sm text-[var(--ink-soft)] mt-2 leading-7">
                معادل دکمه <strong>جدید</strong> در ارمغان: فقط عنوان می‌گیرد. اگر تراکنش از قبل
                دارید، شناسه را بگذارید تا Register زده نشود.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="field sm:col-span-2">
                <label htmlFor="title">عنوان تراکنش</label>
                <input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثل prompt ارمغان — نام تراکنش را وارد کنید"
                />
              </div>
              <div className="field">
                <label htmlFor="period">دوره</label>
                <input
                  id="period"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  placeholder="140508"
                />
              </div>
              <div className="field">
                <label htmlFor="tr">شناسه تراکنش موجود (اختیاری)</label>
                <input
                  id="tr"
                  value={existingTrId}
                  onChange={(e) => setExistingTrId(e.target.value)}
                  placeholder="مثلاً 835"
                  inputMode="numeric"
                />
              </div>
            </div>
          </>
        ) : null}

        {step.id === "txn" && family === "mostamari" ? (
          <>
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-2xl">نوع مستمری و تراکنش</h2>
              <p className="text-sm text-[var(--ink-soft)] mt-2 leading-7">
                اسکریپت Calculate مربوطه روی تراکنش موجود اجرا می‌شود؛ خروجی نهایی اکسل است.
              </p>
            </div>
            <div className="space-y-2 max-h-[36vh] overflow-y-auto">
              {mostamariTypes.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={`type-card ${diskTypeId === d.id ? "is-selected" : ""}`}
                  onClick={() => setDiskTypeId(d.id)}
                >
                  <div className="font-semibold text-sm">{d.titleFa}</div>
                  <p className="text-xs text-[var(--ink-soft)] mt-1">{d.calcProcs.join(" · ")}</p>
                </button>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="field sm:col-span-2">
                <label htmlFor="title-m">عنوان</label>
                <input id="title-m" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="period-m">دوره</label>
                <input id="period-m" value={period} onChange={(e) => setPeriod(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="tr-m">شناسه تراکنش *</label>
                <input
                  id="tr-m"
                  value={existingTrId}
                  onChange={(e) => setExistingTrId(e.target.value)}
                  inputMode="numeric"
                />
              </div>
            </div>
          </>
        ) : null}

        {step.id === "type" ? (
          <>
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-2xl">نوع محاسبه</h2>
              <p className="text-sm text-[var(--ink-soft)] mt-2 leading-7">
                دقیقاً گزینه‌های مودال ارمغان (به‌جز لیست و دیسکت که مراحل بعدی‌اند)، به‌همراه محل
                تأمین برای CalculateMarakezYarane.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {CALC_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className={`type-card ${makeOverType === t.value ? "is-selected" : ""}`}
                  onClick={() => {
                    const v = t.value as MakeOverUiType;
                    setMakeOverType(v);
                    setDiskTypeId(defaultDiskForUiType(v));
                    const defSupply = getDiskType(defaultDiskForUiType(v))?.supplyLocationIds?.[0];
                    if (defSupply) setSupplyLocationId(defSupply);
                  }}
                >
                  <div className="font-semibold text-sm">{t.label}</div>
                  <div className="text-[11px] font-mono text-[var(--ink-soft)] mt-1">
                    Type={t.value}
                  </div>
                </button>
              ))}
            </div>
            <div className="field">
              <label htmlFor="supply-filter">محل تأمین (SupplyLocation)</label>
              <input
                id="supply-filter"
                value={supplyFilter}
                onChange={(e) => setSupplyFilter(e.target.value)}
                placeholder="جستجو در کاتالوگ AmarDB…"
              />
            </div>
            <div className="max-h-[28vh] overflow-y-auto space-y-2">
              {filteredSupply.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`type-card ${supplyLocationId === s.id ? "is-selected" : ""}`}
                  onClick={() => {
                    setSupplyLocationId(s.id);
                    setDiskTypeId(`yrn-sl-${s.id}`);
                  }}
                >
                  <div className="font-semibold text-sm leading-6">
                    #{s.id} · {s.titleFa}
                  </div>
                  <div className="text-[11px] text-[var(--ink-soft)] mt-1 font-mono">
                    {s.keyword}
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : null}

        {step.id === "calc" ? (
          <>
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-2xl">اجرای محاسبه</h2>
              <p className="text-sm text-[var(--ink-soft)] mt-2 leading-7">
                معادل <strong>کلید محاسبه</strong> در ارمغان — با زدن بعدی، اسکریپت این مرحله اجرا
                می‌شود.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--brand)]/25 bg-[#e8f6f4]/60 p-4 text-sm leading-7 space-y-2">
              <div>
                <span className="text-[var(--ink-soft)]">تراکنش: </span>
                <strong className="font-mono">{request?.armaghanTransactionId ?? "—"}</strong>
              </div>
              <div>
                <span className="text-[var(--ink-soft)]">نوع: </span>
                <strong>{disk?.titleFa}</strong>
              </div>
              {family === "yarane" ? (
                <>
                  <div>
                    <span className="text-[var(--ink-soft)]">Type: </span>
                    <code>{makeOverType}</code>
                  </div>
                  <div>
                    <span className="text-[var(--ink-soft)]">SupplyLocationId: </span>
                    <code>{supplyLocationId}</code>
                  </div>
                  <ol className="list-decimal list-inside text-xs text-[var(--ink-soft)] space-y-1 pt-2">
                    <li>POST MakeOver/Calculate Type={makeOverType}</li>
                    <li>CalculateMarakezYarane(@TrId, @SupplyLocationId={supplyLocationId})</li>
                  </ol>
                </>
              ) : (
                <ol className="list-decimal list-inside text-xs text-[var(--ink-soft)] space-y-1 pt-2">
                  {(disk?.scriptSteps || []).map((s) => (
                    <li key={s}>
                      <code>{s}</code>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </>
        ) : null}

        {step.id === "list" ? (
          <>
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-2xl">تهیه لیست افراد</h2>
              <p className="text-sm text-[var(--ink-soft)] mt-2 leading-7">
                تهیه لیست افراد برای این تراکنش.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--line)] p-4 text-sm leading-7">
              با زدن <strong>بعدی</strong> اسکریپت لیست اجرا می‌شود؛ سپس به مرحله گزارش مدیر
              می‌روید.
            </div>
          </>
        ) : null}

        {step.id === "excel" ? (
          <>
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-2xl">تهیه اکسل مستمری</h2>
              <p className="text-sm text-[var(--ink-soft)] mt-2 leading-7">
                مطابق brief مدیر: خروجی مستمری داخل همین پنل به‌صورت اکسل است.
              </p>
            </div>
          </>
        ) : null}

        {step.id === "manager" ? (
          <>
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-2xl">گزارش و اقدام مدیر</h2>
              <p className="text-sm text-[var(--ink-soft)] mt-2 leading-7">
                {family === "yarane"
                  ? "یارانه: بعد از لیست، ادامه با واحد مالی. دیسکت بانک اختیاری است."
                  : "مستمری: اکسل آماده است؛ می‌توانید وضعیت را آماده ثبت کنید."}
              </p>
            </div>

            <dl className="grid sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-[var(--line)] p-3">
                <dt className="text-xs text-[var(--ink-soft)]">شناسه درخواست پنل</dt>
                <dd className="font-mono mt-1">{request?.id || "—"}</dd>
              </div>
              <div className="rounded-xl border border-[var(--line)] p-3">
                <dt className="text-xs text-[var(--ink-soft)]">تراکنش ارمغان</dt>
                <dd className="font-mono mt-1">{request?.armaghanTransactionId || "—"}</dd>
              </div>
              <div className="rounded-xl border border-[var(--line)] p-3">
                <dt className="text-xs text-[var(--ink-soft)]">وضعیت</dt>
                <dd className="font-semibold mt-1">{request?.status || "—"}</dd>
              </div>
              <div className="rounded-xl border border-[var(--line)] p-3">
                <dt className="text-xs text-[var(--ink-soft)]">فایل</dt>
                <dd className="font-mono mt-1 break-all text-xs">{request?.fileName || "—"}</dd>
              </div>
            </dl>

            <div className="rounded-xl border border-[var(--line)] overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--line)] text-sm font-semibold">
                {reportTitle || "گزارش بازرسی"}
              </div>
              <div className="requests-table w-full">
                <table className="data">
                  <thead>
                    <tr>
                      {(reportCols.length ? reportCols : ["—"]).map((c) => (
                        <th key={c}>{columnTitleFa(c)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {!reportRows?.length ? (
                      <tr>
                        <td colSpan={Math.max(1, reportCols.length)} className="text-center py-6">
                          داده‌ای نیست
                        </td>
                      </tr>
                    ) : (
                      reportRows.slice(0, 20).map((row, i) => (
                        <tr key={i}>
                          {reportCols.map((c) => (
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
            </div>

            <div className="flex flex-wrap gap-2">
              {family === "yarane" ? (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => managerAction("handoff_finance")}
                  >
                    تحویل به واحد مالی
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={busy}
                    onClick={() => managerAction("diskette")}
                  >
                    دیسکت بانک (اختیاری)
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => managerAction("mark_ready")}
                >
                  تایید اکسل آماده
                </button>
              )}
              <Link href="/reports" className="btn btn-ghost">
                گزارش‌های بیشتر
              </Link>
              <Link href="/" className="btn btn-ghost">
                تاریخچه درخواست‌ها
              </Link>
            </div>

            {request?.logTail?.length ? (
              <pre className="text-xs whitespace-pre-wrap break-words font-mono text-[var(--ink-soft)] max-h-40 overflow-y-auto p-3 rounded-xl bg-[var(--paper)] border border-[var(--line)]">
                {request.logTail.slice(-12).join("\n")}
              </pre>
            ) : null}
          </>
        ) : null}

        {lastStepMsg && step.id !== "manager" ? (
          <div className="rounded-xl border border-[var(--brand)]/30 bg-[#e8f6f4] px-4 py-3 text-xs font-mono leading-6">
            {lastStepMsg}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-xl bg-[#fde6e9] text-[var(--bad)] px-4 py-3 text-sm">{error}</div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy || stepIdx === 0}
          onClick={() => {
            setError(null);
            setStepIdx((i) => Math.max(0, i - 1));
          }}
        >
          قبلی
        </button>
        <div className="text-xs text-[var(--ink-soft)]">
          مرحله {stepIdx + 1} از {steps.length}
          {request?.id ? ` · ${request.id}` : ""}
        </div>
        {step.id === "manager" ? (
          <span className="text-xs text-[var(--ink-soft)]">اقدام‌ها را از بالا انتخاب کنید</span>
        ) : (
          <button type="button" className="btn btn-primary" disabled={busy} onClick={goNext}>
            {busy
              ? "در حال اجرا…"
              : step.id === "calc" || step.id === "list" || step.id === "excel" || step.id === "txn"
                ? "اجرای این مرحله و بعدی"
                : "بعدی"}
          </button>
        )}
      </div>
    </div>
  );
}
