"use client";

import { useCallback, useEffect, useState } from "react";
import { LoadingBlock, LoadingSpinner } from "@/components/LoadingSpinner";

type TargetCard = {
  id: "prod" | "replica" | "test";
  labelFa: string;
  host: string;
  database: string;
  port: number;
  auth: "sql" | "windows";
  user: string;
  writable: boolean;
  active: boolean;
};

type DbInfo = {
  target: string;
  mode: string;
  activeLabel: string;
  labWrites: boolean;
  canSwitch: boolean;
  targets: TargetCard[];
  note: string;
  schema?: {
    hasMakeOverDefinitions: boolean;
    hasTxnDefinitionId: boolean;
  } | null;
};

const DB_CHANGED_KEY = "paydisk-db-target";
const FETCH_MS = 12000;

function notifyDbChanged(target: string) {
  try {
    localStorage.setItem(DB_CHANGED_KEY, `${target}|${Date.now()}`);
  } catch {
    /* private mode */
  }
  window.dispatchEvent(
    new CustomEvent("paydisk-db-changed", { detail: { target } }),
  );
}

async function fetchJson(url: string, init?: RequestInit, ms = FETCH_MS) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  try {
    const res = await fetch(url, { ...init, signal: ac.signal });
    const d = await res.json();
    return { res, d };
  } finally {
    clearTimeout(timer);
  }
}

export function DbSettingsPanel() {
  const [info, setInfo] = useState<DbInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { res, d } = await fetchJson("/api/settings/db");
      if (!res.ok || !d.ok) {
        setError(d.message || "بارگذاری ناموفق");
        return;
      }
      setInfo(d);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("بارگذاری تنظیمات بیش از حد طول کشید — دوباره تلاش کنید");
      } else {
        setError("خطای شبکه");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function selectTarget(id: TargetCard["id"]) {
    if (!info?.canSwitch || switching || id === info.target) return;

    const previous = info;
    const nextMeta = previous.targets.find((t) => t.id === id);

    // Optimistic UI — badge flips immediately; server confirms/reverts
    setSwitching(id);
    setError(null);
    setInfo({
      ...previous,
      target: id,
      mode: id,
      activeLabel: nextMeta
        ? `${nextMeta.host}/${nextMeta.database}`
        : previous.activeLabel,
      labWrites: id === "test" ? true : id === "prod" ? previous.labWrites : false,
      note: nextMeta
        ? id === "test"
          ? "در حال اتصال به آزمایشی…"
          : `در حال فعال‌سازی ${nextMeta.labelFa} · ${nextMeta.host}/${nextMeta.database}…`
        : previous.note,
      targets: previous.targets.map((t) => ({
        ...t,
        active: t.id === id,
      })),
    });

    try {
      // Lab: driver preload + ODBC LoginTimeout (~10s) + small buffer
      const budget = id === "test" ? 30000 : 15000;
      const { res, d } = await fetchJson(
        "/api/settings/db",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target: id }),
        },
        budget,
      );
      if (!res.ok || !d.ok) {
        setInfo(previous);
        setError(d.message || "تعویض دیتابیس ناموفق");
        return;
      }
      notifyDbChanged(d.target);
      setInfo((prev) =>
        prev
          ? {
              ...prev,
              target: d.target,
              mode: d.mode || d.target,
              activeLabel: d.activeLabel,
              labWrites: !!d.labWrites,
              schema: d.schema ?? prev.schema,
              note: "",
              targets: prev.targets.map((t) => ({
                ...t,
                active: t.id === d.target,
              })),
            }
          : prev,
      );
    } catch (err) {
      setInfo(previous);
      if (err instanceof DOMException && err.name === "AbortError") {
        setError(
          id === "test"
            ? "اتصال به آزمایشی قطع شد (timeout). شبکه/ODBC را بررسی کنید یا هدف دیگری انتخاب کنید."
            : "تعویض دیتابیس بیش از حد طول کشید",
        );
      } else {
        setError("خطای شبکه در تعویض دیتابیس");
      }
    } finally {
      setSwitching(null);
    }
  }

  // Only full-page spinner on first paint — remounts keep prior cards if any
  if (loading && !info) {
    return <LoadingBlock label="بارگذاری تنظیمات دیتابیس…" />;
  }

  if (!info) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl bg-[#fde6e9] text-[var(--bad)] px-4 py-3 text-sm">
          {error || "اطلاعات دیتابیس در دسترس نیست"}
        </div>
        <button
          type="button"
          className="text-sm text-[var(--brand)] underline"
          onClick={() => void load()}
        >
          تلاش دوباره
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="panel p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">اتصال فعال</h2>
          {loading || switching ? <LoadingSpinner size="sm" inline /> : null}
        </div>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <Field
            label="هدف"
            value={
              info.targets.find((t) => t.id === info.target)?.labelFa ||
              info.target
            }
          />
          <Field label="آدرس" value={info.activeLabel} />
          <Field
            label="نوشتن / محاسبه"
            value={info.labWrites ? "فعال (lab)" : "غیرفعال — فقط خواندن"}
          />
          <Field
            label="اسکیما"
            value={
              info.schema?.hasMakeOverDefinitions &&
              info.schema?.hasTxnDefinitionId
                ? "lab — MakeOverDefinitions"
                : "AmarDB — PayedMakeOvers"
            }
          />
        </div>
        {!info.canSwitch ? (
          <p className="text-xs text-[var(--bad)]">
            فقط ادمین می‌تواند دیتابیس فعال را عوض کند.
          </p>
        ) : null}
        {error ? (
          <div className="rounded-xl bg-[#fde6e9] text-[var(--bad)] px-3 py-2 text-xs">
            {error}
          </div>
        ) : null}
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        {info.targets.map((t) => {
          const busy = switching === t.id;
          const active = t.active;
          return (
            <button
              key={t.id}
              type="button"
              disabled={!info.canSwitch || !!switching}
              onClick={() => void selectTarget(t.id)}
              aria-pressed={active}
              className={`db-target-card panel p-4 text-right space-y-2 transition-all ${
                active ? "db-target-card--active" : ""
              } ${!info.canSwitch ? "opacity-90 cursor-default" : "hover:bg-[var(--paper-2)]"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-sm">{t.labelFa}</h3>
                {busy ? (
                  <LoadingSpinner size="sm" inline />
                ) : active ? (
                  <span className="db-target-card__badge">فعال</span>
                ) : (
                  <span className="text-[11px] text-[var(--ink-soft)]">
                    انتخاب
                  </span>
                )}
              </div>
              <Field label="Host" value={t.host} />
              <Field label="Database" value={t.database} />
              <Field
                label="Auth"
                value={
                  t.auth === "windows"
                    ? "Windows (Trusted)"
                    : `SQL · ${t.user}`
                }
              />
              <Field
                label="دسترسی پنل"
                value={t.writable ? "خواندن + نوشتن" : "فقط خواندن"}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-[var(--line)] p-3">
      <div className="text-[11px] text-[var(--ink-soft)]">{label}</div>
      <div className="mt-1 text-sm font-semibold break-all">{value}</div>
    </div>
  );
}
