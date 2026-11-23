"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { FaDataTable } from "@/components/FaDataTable";
import { LoadingSpinner } from "@/components/LoadingSpinner";

export type SayahMatchScope =
  | "mostamari-ibn"
  | "mostamari-pay"
  | "yarane-center";

type SayahStats = {
  checked: number;
  matchCount: number;
  mismatchCount: number;
  errorCount: number;
  totalEligible: number;
  transports?: string[];
};

type SayahMismatch = {
  nationalId: string;
  shebaId: string;
  result: { message: string | null; matched?: boolean | null };
};

type Props = {
  scope: SayahMatchScope;
  trId?: number | null;
  /** Extra help under the title */
  hint?: ReactNode;
  isAdmin?: boolean;
  /** External disable (e.g. parent nav lock). Spinner stays local via `running`. */
  busy?: boolean;
  /** Notify parent so stepper/قبلی/ادامه stay locked while Sayah runs. */
  onBusy?: (busy: boolean) => void;
  onError?: (message: string | null) => void;
  /** Gate passed (or admin override recorded by parent). */
  gateOk: boolean;
  onGateChange: (ok: boolean) => void;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  onPrev?: () => void;
  onNext?: () => void;
  nextDisabled?: boolean;
  nextLabel?: string;
  /** Optional trailing controls (e.g. Mostamari NavButtons extras). */
  footerExtra?: ReactNode;
  /** When true, render only the body (parent supplies NavButtons). */
  hideNav?: boolean;
};

export function SayahMatchPanel(props: Props) {
  const [limit, setLimit] = useState(10);
  const [msg, setMsg] = useState<string | null>(null);
  const [stats, setStats] = useState<SayahStats | null>(null);
  const [mismatches, setMismatches] = useState<SayahMismatch[]>([]);
  const [svc, setSvc] = useState<{
    configured: boolean;
    mode: string;
    restReady: boolean;
    soapReady: boolean;
  } | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/sayah/match");
        const data = await res.json();
        if (cancelled || !data?.ok) return;
        setSvc({
          configured: !!data.configured,
          mode: String(data.mode || "auto"),
          restReady: !!data.restReady,
          soapReady: !!data.soapReady,
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const run = useCallback(async () => {
    setRunning(true);
    props.onBusy?.(true);
    props.onError?.(null);
    setMsg(null);
    try {
      const res = await fetch("/api/sayah/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "batch",
          scope: props.scope,
          trId: props.trId || undefined,
          limit,
          delayMs: 40,
          concurrency: 4,
        }),
      });
      const data = await res.json();
      props.onCheckedChange(true);
      if (!res.ok || !data.ok) {
        props.onGateChange(false);
        const m = data.message || "خطا در فراخوانی سیاح";
        setMsg(m);
        props.onError?.(m);
        return;
      }
      props.onGateChange(!!data.gateOk);
      setMsg(data.message || null);
      setStats({
        checked: Number(data.checked || 0),
        matchCount: Number(data.matchCount || 0),
        mismatchCount: Number(data.mismatchCount || 0),
        errorCount: Number(data.errorCount || 0),
        totalEligible: Number(data.totalEligible || 0),
        transports: Array.isArray(data.transports) ? data.transports : [],
      });
      setMismatches(Array.isArray(data.mismatches) ? data.mismatches : []);
    } catch {
      props.onCheckedChange(true);
      props.onGateChange(false);
      props.onError?.("خطای شبکه در تطبیق سیاح");
      setMsg("خطای شبکه در تطبیق سیاح");
    } finally {
      setRunning(false);
      props.onBusy?.(false);
    }
  }, [limit, props]);

  const locked = !!props.busy || running;

  return (
    <div className="panel p-5 space-y-4">
      <h2 className="font-[family-name:var(--font-display)] text-2xl">
        تطبیق شبا (سیاح)
      </h2>
      <p className="text-sm text-[var(--ink-soft)] leading-7">
        {props.hint || (
          <>
            قبل از محاسبه، تعلق شبا به کد/شناسه ملی در سامانه سیاح بانک مرکزی
            بررسی می‌شود تا دیسکت با عدم تطابق صادر نشود.
          </>
        )}
      </p>

      {svc ? (
        <div className="text-xs text-[var(--ink-soft)] flex flex-wrap gap-2">
          <span>
            وضعیت سرویس:{" "}
            {svc.configured ? (
              <span className="text-[var(--brand)]">آماده</span>
            ) : (
              <span className="text-[var(--bad)]">پیکربندی ناقص</span>
            )}
          </span>
          <span>· حالت {svc.mode}</span>
          {svc.restReady ? <span>· REST ✓</span> : <span>· REST ✗</span>}
          {svc.soapReady ? <span>· SOAP ✓</span> : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-[var(--ink-soft)]">تعداد نمونه</span>
          <select
            className="rounded-lg border border-[var(--line)] px-2 py-1 bg-white"
            value={limit}
            disabled={locked}
            onChange={(e) => setLimit(Number(e.target.value) || 10)}
          >
            {[10, 20, 30, 50].map((n) => (
              <option key={n} value={n}>
                {n.toLocaleString("fa-IR")}
              </option>
            ))}
          </select>
        </label>
        {stats ? (
          <span className="text-xs text-[var(--ink-soft)]">
            واجد شرایط: {stats.totalEligible.toLocaleString("fa-IR")} · بررسی:{" "}
            {stats.checked.toLocaleString("fa-IR")} · تطبیق:{" "}
            {stats.matchCount.toLocaleString("fa-IR")} · عدم تطبیق:{" "}
            {stats.mismatchCount.toLocaleString("fa-IR")}
            {stats.errorCount
              ? ` · خطا: ${stats.errorCount.toLocaleString("fa-IR")}`
              : ""}
            {stats.transports?.length
              ? ` · مسیر: ${stats.transports.join("+")}`
              : ""}
          </span>
        ) : null}
      </div>

      {msg ? (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${
            props.gateOk
              ? "bg-[#e8f4ee] text-[#1f7a4d]"
              : "bg-[#fdecea] text-[#a33]"
          }`}
        >
          {msg}
        </div>
      ) : !props.checked ? (
        <p className="text-xs text-[var(--ink-soft)]">
          هنوز بررسی انجام نشده — «اجرای تطبیق سیاح» را بزنید.
        </p>
      ) : null}

      {mismatches.length > 0 ? (
        <FaDataTable
          columns={["nationalId", "shebaId", "message"]}
          columnTitles={{
            nationalId: "کد/شناسه",
            shebaId: "شبا",
            message: "نتیجه",
          }}
          rows={mismatches.slice(0, 50).map((r) => ({
            nationalId: r.nationalId,
            shebaId: r.shebaId,
            message: r.result.message || "عدم تطبیق",
          }))}
          empty="—"
        />
      ) : null}

      {!props.hideNav ? (
        <div className="flex flex-wrap items-center gap-2 w-full" role="group">
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
          <button
            type="button"
            className="btn btn-primary"
            disabled={locked || svc?.configured === false}
            onClick={() => void run()}
          >
            {running ? <LoadingSpinner size="sm" inline /> : null}
            اجرای تطبیق سیاح
          </button>
          {props.onNext ? (
            <button
              type="button"
              className="btn btn-ghost"
              disabled={locked || props.nextDisabled}
              onClick={props.onNext}
            >
              {props.nextLabel || "ادامه به محاسبه"}
            </button>
          ) : null}
          {props.footerExtra}
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-primary"
          disabled={locked || svc?.configured === false}
          onClick={() => void run()}
        >
          {running ? <LoadingSpinner size="sm" inline /> : null}
          اجرای تطبیق سیاح
        </button>
      )}

      {!props.gateOk && props.checked && props.isAdmin ? (
        <p className="text-xs text-[var(--ink-soft)]">
          به‌عنوان ادمین می‌توانید با وجود عدم تطبیق/خطا ادامه دهید (مسئولیت رفع
          داده با شماست).
        </p>
      ) : null}
    </div>
  );
}
