"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  JALALI_MONTHS_FA,
  formatShamsiDisplay,
  gregorianToJalali,
  isoToShamsi,
  jalaliMonthLength,
  shamsiToIso,
} from "@/lib/shamsi";

function todayShamsi() {
  const n = new Date();
  return gregorianToJalali(n.getFullYear(), n.getMonth() + 1, n.getDate());
}

function toFa(n: number) {
  return String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]!);
}

export function PersianDatePicker({
  id,
  label,
  value,
  onChange,
  disabled,
  allowClear = true,
}: {
  id?: string;
  label?: string;
  /** Gregorian YYYY-MM-DD (API / DB) */
  value: string;
  onChange: (isoYmd: string) => void;
  disabled?: boolean;
  allowClear?: boolean;
}) {
  const autoId = useId();
  const fieldId = id || autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const selected = value ? isoToShamsi(value) : null;
  const initial = selected || todayShamsi();
  const [viewJy, setViewJy] = useState(initial.jy);
  const [viewJm, setViewJm] = useState(initial.jm);

  useEffect(() => {
    if (!selected) return;
    setViewJy(selected.jy);
    setViewJm(selected.jm);
  }, [selected?.jy, selected?.jm]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const days = useMemo(() => {
    const len = jalaliMonthLength(viewJy, viewJm);
    // Weekday of 1st: get gregorian, then getDay (0=Sun). Jalali week often Sat-start.
    const { gy, gm, gd } = (() => {
      const g = shamsiToIso(viewJy, viewJm, 1);
      const [y, m, d] = g.split("-").map(Number);
      return { gy: y!, gm: m!, gd: d! };
    })();
    const first = new Date(gy, gm - 1, gd, 12);
    // Convert JS Sunday=0 → Saturday=0 index for fa week
    const jsDow = first.getDay(); // 0 Sun .. 6 Sat
    const startOffset = (jsDow + 1) % 7; // Sat=0
    const cells: Array<{ day: number | null }> = [];
    for (let i = 0; i < startOffset; i++) cells.push({ day: null });
    for (let d = 1; d <= len; d++) cells.push({ day: d });
    return cells;
  }, [viewJy, viewJm]);

  const display = selected
    ? formatShamsiDisplay(selected.jy, selected.jm, selected.jd)
    : "انتخاب تاریخ…";

  function shiftMonth(delta: number) {
    let m = viewJm + delta;
    let y = viewJy;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setViewJm(m);
    setViewJy(y);
  }

  function pick(day: number) {
    onChange(shamsiToIso(viewJy, viewJm, day));
    setOpen(false);
  }

  return (
    <div className="field persian-date" ref={rootRef}>
      {label ? <label htmlFor={fieldId}>{label}</label> : null}
      <button
        id={fieldId}
        type="button"
        className={`persian-date__trigger${open ? " is-open" : ""}`}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{display}</span>
        <span className="persian-date__icon" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <div className="persian-date__panel" role="dialog">
          <div className="persian-date__nav">
            <button type="button" className="persian-date__nav-btn" onClick={() => shiftMonth(1)}>
              ‹
            </button>
            <div className="persian-date__nav-title">
              {JALALI_MONTHS_FA[viewJm - 1]} {toFa(viewJy)}
            </div>
            <button type="button" className="persian-date__nav-btn" onClick={() => shiftMonth(-1)}>
              ›
            </button>
          </div>
          <div className="persian-date__weekdays">
            {["ش", "ی", "د", "س", "چ", "پ", "ج"].map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>
          <div className="persian-date__grid">
            {days.map((c, i) =>
              c.day == null ? (
                <span key={`e-${i}`} className="persian-date__empty" />
              ) : (
                <button
                  key={c.day}
                  type="button"
                  className={`persian-date__day${
                    selected &&
                    selected.jy === viewJy &&
                    selected.jm === viewJm &&
                    selected.jd === c.day
                      ? " is-active"
                      : ""
                  }`}
                  onClick={() => pick(c.day!)}
                >
                  {toFa(c.day)}
                </button>
              ),
            )}
          </div>
          <div className="persian-date__footer">
            {allowClear ? (
              <button
                type="button"
                className="btn btn-ghost text-xs"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                پاک کردن
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              className="btn btn-ghost text-xs"
              onClick={() => {
                const t = todayShamsi();
                onChange(shamsiToIso(t.jy, t.jm, t.jd));
                setViewJy(t.jy);
                setViewJm(t.jm);
                setOpen(false);
              }}
            >
              امروز
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
