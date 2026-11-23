"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { UiSelect } from "@/components/UiSelect";
import { LoadingSpinner } from "@/components/LoadingSpinner";

/** Keep ASCII digits; map Persian/Arabic-Indic numerals. */
function toAsciiDigits(raw: string) {
  return raw
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[^\d]/g, "");
}

export type ShebaReportFilters = {
  trId: string;
  pageSize: number;
  FirstName: string;
  LastName: string;
  NID: string;
  Center: string;
  /** استان title from dbo.Province */
  Province: string;
  Account: string;
  NationalId: string;
  ibn: string;
  /** Switch: فقط مغایرت سیاح/فرمت (بدون فاقد شبا) */
  onlySayahMismatch: boolean;
};

export const EMPTY_SHEBA_REPORT_FILTERS: ShebaReportFilters = {
  trId: "",
  pageSize: 15,
  FirstName: "",
  LastName: "",
  NID: "",
  Center: "",
  Province: "",
  Account: "",
  NationalId: "",
  ibn: "",
  onlySayahMismatch: false,
};

const PAGE_SIZE_OPTIONS = [
  { value: "10", label: "۱۰" },
  { value: "15", label: "۱۵" },
  { value: "25", label: "۲۵" },
  { value: "50", label: "۵۰" },
];

const MISMATCH_STATUS_OPTIONS = [
  { value: "all", label: "همه مغایرت‌ها" },
  { value: "sayah", label: "فقط سیاح / فرمت" },
];

const TEXT_FIELDS: Array<{
  key: keyof Pick<
    ShebaReportFilters,
    "FirstName" | "LastName" | "NID" | "Account" | "NationalId" | "ibn"
  >;
  label: string;
  placeholder: string;
}> = [
  { key: "FirstName", label: "نام", placeholder: "جستجوی نام…" },
  { key: "LastName", label: "نام خانوادگی", placeholder: "جستجوی نام خانوادگی…" },
  { key: "NID", label: "کد ملی", placeholder: "کد ملی…" },
  { key: "Account", label: "حساب", placeholder: "شماره حساب…" },
  { key: "NationalId", label: "شناسه مرکز", placeholder: "شناسه ملی/حقوقی مرکز…" },
  { key: "ibn", label: "شبا", placeholder: "شبا…" },
];

type CenterHit = { id: number; title: string; payRows: number };

async function fetchCenters(opts: {
  trId: string;
  q?: string;
  limit: number;
  signal?: AbortSignal;
}): Promise<CenterHit[]> {
  const params = new URLSearchParams({ limit: String(opts.limit) });
  if (opts.q?.trim()) params.set("q", opts.q.trim());
  const tid = toAsciiDigits(opts.trId);
  if (tid) params.set("trId", tid);
  const res = await fetch(
    `/api/reports/sheba-deviations/centers?${params}`,
    { signal: opts.signal },
  );
  const data = await res.json();
  if (!res.ok || !data.ok) return [];
  return (data.centers || []) as CenterHit[];
}

/**
 * Searchable مرکز filter:
 * - On startup / trId change: load only 5 centers
 * - While typing: search and show matches
 */
function CenterSuggest({
  trId,
  value,
  onChange,
  onPick,
}: {
  trId: string;
  value: string;
  onChange: (v: string) => void;
  onPick: (title: string) => void;
}) {
  const [seed, setSeed] = useState<CenterHit[]>([]);
  const [hits, setHits] = useState<CenterHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pickedRef = useRef(false);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Startup / trId change → only 5 centers
  useEffect(() => {
    const ac = new AbortController();
    let alive = true;
    setSearching(true);
    fetchCenters({ trId, limit: 5, signal: ac.signal })
      .then((centers) => {
        if (!alive) return;
        setSeed(centers);
        if (!value.trim()) setHits(centers);
      })
      .catch(() => {
        if (!alive) return;
        setSeed([]);
      })
      .finally(() => {
        if (alive) setSearching(false);
      });
    return () => {
      alive = false;
      ac.abort();
    };
    // Intentionally not depending on value — seed is initial list only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trId]);

  // Typing → server search; empty → show seed of 5
  useEffect(() => {
    if (pickedRef.current) {
      pickedRef.current = false;
      return;
    }
    const q = value.trim();
    if (!q) {
      setHits(seed);
      return;
    }
    const ac = new AbortController();
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const centers = await fetchCenters({
          trId,
          q,
          limit: 20,
          signal: ac.signal,
        });
        setHits(centers);
        if (centers.length) setOpen(true);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setHits([]);
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [value, trId, seed]);

  function pick(c: CenterHit) {
    pickedRef.current = true;
    onPick(c.title);
    setHits(seed);
    setOpen(false);
  }

  const list = hits.length ? hits : seed;

  return (
    <div className="field registrar-suggest" ref={wrapRef}>
      <label htmlFor="sheba-filter-Center">مرکز</label>
      <div className="registrar-suggest__wrap">
        <input
          id="sheba-filter-Center"
          className="ui-input"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (!value.trim()) setHits(seed);
            setOpen(true);
          }}
          placeholder="جستجو یا انتخاب مرکز…"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
        />
        {searching ? (
          <span className="registrar-suggest__spinner">
            <LoadingSpinner size="sm" inline label={null} />
          </span>
        ) : null}
        {open ? (
          <ul className="registrar-suggest__menu" role="listbox">
            <li>
              <button
                type="button"
                className="registrar-suggest__option"
                onClick={() => {
                  pickedRef.current = true;
                  onPick("");
                  setHits(seed);
                  setOpen(false);
                }}
              >
                <span className="registrar-suggest__name">همه مراکز</span>
              </button>
            </li>
            {list.length === 0 ? (
              <li className="ui-select-empty px-3 py-2 text-xs text-[var(--ink-soft)]">
                مرکزی یافت نشد
              </li>
            ) : (
              list.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="registrar-suggest__option"
                    onClick={() => pick(c)}
                  >
                    <span className="registrar-suggest__name">{c.title}</span>
                    <span className="registrar-suggest__meta">
                      #{c.id}
                      {c.payRows > 0
                        ? ` · ${c.payRows.toLocaleString("fa-IR")} ردیف`
                        : ""}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function ProvinceSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (title: string) => void;
}) {
  const [options, setOptions] = useState<Array<{ value: string; label: string }>>(
    [{ value: "", label: "همه استان‌ها" }],
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    let alive = true;
    setLoading(true);
    fetch("/api/reports/sheba-deviations/provinces?limit=40", {
      signal: ac.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        const provinces = Array.isArray(data.provinces) ? data.provinces : [];
        setOptions([
          { value: "", label: "همه استان‌ها" },
          ...provinces.map((p: { id: number; title: string }) => ({
            value: String(p.title || "").trim(),
            label: String(p.title || "").trim() || `استان ${p.id}`,
          })),
        ]);
      })
      .catch(() => {
        if (!alive) return;
        setOptions([{ value: "", label: "همه استان‌ها" }]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
      ac.abort();
    };
  }, []);

  const selectOptions = useMemo(() => {
    if (!value.trim()) return options;
    if (options.some((o) => o.value === value)) return options;
    return [...options, { value, label: value }];
  }, [options, value]);

  return (
    <UiSelect
      id="sheba-filter-Province"
      label="استان"
      value={value}
      options={selectOptions}
      onChange={onChange}
      placeholder={loading ? "بارگذاری استان‌ها…" : "همه استان‌ها"}
      searchable
      searchPlaceholder="جستجوی استان…"
      disabled={loading && options.length <= 1}
    />
  );
}

/** Side filters — same layout pattern as home TxnFilterBar. */
export function ShebaReportFilterBar({
  value,
  onChange,
  onApply,
}: {
  value: ShebaReportFilters;
  onChange: (next: ShebaReportFilters) => void;
  onApply: (next?: ShebaReportFilters) => void;
  loading?: boolean;
}) {
  function patch(partial: Partial<ShebaReportFilters>) {
    onChange({ ...value, ...partial });
  }

  function applyPatch(partial: Partial<ShebaReportFilters>) {
    const next = { ...value, ...partial };
    onChange(next);
    onApply(next);
  }

  const activeCount = useMemo(() => {
    let n = TEXT_FIELDS.filter((f) => value[f.key].trim()).length;
    if (value.Center.trim()) n += 1;
    if (value.Province.trim()) n += 1;
    if (value.onlySayahMismatch) n += 1;
    return n;
  }, [value]);

  return (
    <form
      className="txn-filter"
      onSubmit={(e) => {
        e.preventDefault();
        onApply(value);
      }}
    >
      <div className="field">
        <label htmlFor="sheba-filter-trId">شناسه تراکنش</label>
        <input
          id="sheba-filter-trId"
          value={value.trId}
          onChange={(e) => {
            const trId = toAsciiDigits(e.target.value);
            patch({
              trId,
              Center: trId === value.trId ? value.Center : "",
            });
          }}
          placeholder="مثلاً ۷۲۷"
          inputMode="numeric"
          dir="ltr"
        />
      </div>

      {TEXT_FIELDS.slice(0, 3).map((f) => (
        <div className="field" key={f.key}>
          <label htmlFor={`sheba-filter-${f.key}`}>{f.label}</label>
          <input
            id={`sheba-filter-${f.key}`}
            value={value[f.key]}
            onChange={(e) => patch({ [f.key]: e.target.value })}
            placeholder={f.placeholder}
          />
        </div>
      ))}

      <ProvinceSelect
        value={value.Province}
        onChange={(title) => applyPatch({ Province: title })}
      />

      <CenterSuggest
        trId={value.trId}
        value={value.Center}
        onChange={(v) => patch({ Center: v })}
        onPick={(title) => applyPatch({ Center: title })}
      />

      {TEXT_FIELDS.slice(3).map((f) => (
        <div className="field" key={f.key}>
          <label htmlFor={`sheba-filter-${f.key}`}>{f.label}</label>
          <input
            id={`sheba-filter-${f.key}`}
            value={value[f.key]}
            onChange={(e) => patch({ [f.key]: e.target.value })}
            placeholder={f.placeholder}
          />
        </div>
      ))}

      <UiSelect
        id="sheba-filter-status"
        label="وضعیت مغایرت"
        value={value.onlySayahMismatch ? "sayah" : "all"}
        options={MISMATCH_STATUS_OPTIONS}
        onChange={(v) => applyPatch({ onlySayahMismatch: v === "sayah" })}
        searchable
        searchPlaceholder="جستجوی وضعیت…"
      />

      <div className="txn-filter__actions">
        <button type="submit" className="btn btn-primary text-xs">
          اعمال فیلتر
        </button>
        <button
          type="button"
          className="btn btn-ghost text-xs"
          disabled={activeCount === 0}
          onClick={() => {
            const cleared: ShebaReportFilters = {
              ...EMPTY_SHEBA_REPORT_FILTERS,
              trId: value.trId,
              pageSize: value.pageSize,
            };
            onChange(cleared);
            onApply(cleared);
          }}
        >
          پاک کردن
          {activeCount ? ` (${activeCount.toLocaleString("fa-IR")})` : ""}
        </button>
      </div>
    </form>
  );
}

/** Toolbar above the table — transaction id + page size. */
export function ShebaReportToolbar({
  value,
  onChange,
  onApply,
}: {
  value: ShebaReportFilters;
  onChange: (next: ShebaReportFilters) => void;
  onApply: (next?: ShebaReportFilters) => void;
  loading?: boolean;
}) {
  function patch(partial: Partial<ShebaReportFilters>) {
    onChange({ ...value, ...partial });
  }

  return (
    <form
      className="toolbar-form"
      onSubmit={(e) => {
        e.preventDefault();
        onApply(value);
      }}
    >
      <div className="field">
        <label htmlFor="sheba-toolbar-trId">شناسه تراکنش</label>
        <input
          id="sheba-toolbar-trId"
          value={value.trId}
          onChange={(e) => {
            const trId = toAsciiDigits(e.target.value);
            patch({ trId, Center: trId === value.trId ? value.Center : "" });
          }}
          placeholder="مثلاً ۷۲۷"
          inputMode="numeric"
          dir="ltr"
        />
      </div>
      <UiSelect
        id="sheba-toolbar-ps"
        label="در صفحه"
        value={String(value.pageSize)}
        options={PAGE_SIZE_OPTIONS}
        searchable
        searchPlaceholder="جستجو…"
        onChange={(v) => {
          const next = { ...value, pageSize: Number(v) };
          onChange(next);
          onApply(next);
        }}
      />
      <button
        type="submit"
        className="btn btn-primary text-xs toolbar-form__submit"
      >
        جستجو
      </button>
    </form>
  );
}

export function hasShebaReportScope(filters: ShebaReportFilters): boolean {
  const trId = toAsciiDigits(filters.trId);
  if (trId) return true;
  if (filters.Center.trim()) return true;
  if (filters.Province.trim()) return true;
  return TEXT_FIELDS.some((f) => filters[f.key].trim());
}

export function shebaFiltersToParams(
  filters: ShebaReportFilters,
  extra?: Record<string, string>,
) {
  const params = new URLSearchParams(extra);
  const trId = toAsciiDigits(filters.trId);
  if (trId) params.set("trId", trId);
  params.set("pageSize", String(filters.pageSize));
  for (const f of TEXT_FIELDS) {
    const v = filters[f.key].trim();
    if (v) params.set(f.key, v);
  }
  if (filters.Center.trim()) params.set("Center", filters.Center.trim());
  if (filters.Province.trim()) params.set("Province", filters.Province.trim());
  if (filters.onlySayahMismatch) params.set("onlySayahMismatch", "1");
  return params;
}
