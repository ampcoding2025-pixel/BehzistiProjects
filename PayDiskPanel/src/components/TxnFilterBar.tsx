"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { TriFilter } from "@/lib/armaghan/inspect";
import { PersianDatePicker } from "@/components/PersianDatePicker";
import { UiSelect } from "@/components/UiSelect";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import {
  YARANE_DOC_TYPES,
  YARANE_EXTRA_TYPES,
} from "@/lib/wizard/yarane-types";
import { mostamariTypeOptions } from "@/lib/auth/disk-types";
import type { DiskFamily } from "@/lib/types";

export type TxnFamilyFilter = "" | DiskFamily;

/** تاییدشده = لیست افراد / پذیرش؛ پیش‌نویس = هنوز تایید نشده */
export type TxnStatusFilter = "" | "approved" | "draft";

export type TxnFilterValues = {
  q: string;
  pageSize: number;
  /** یارانه | مستمری | همه */
  family: TxnFamilyFilter;
  /** One or more MakeOverSupplyLocationId values (یارانه). */
  supplyLocationIds: string[];
  /** Mostamari catalog typeIds (mst-base, …). */
  mostamariTypeIds: string[];
  dateFrom: string;
  dateTo: string;
  hasBank: TriFilter;
  hasPeopleList: TriFilter;
  /** همه | تاییدشده | پیش‌نویس (draft) */
  status: TxnStatusFilter;
  registrar: string;
};

export const EMPTY_TXN_FILTERS: TxnFilterValues = {
  q: "",
  pageSize: 15,
  family: "yarane",
  supplyLocationIds: [],
  mostamariTypeIds: [],
  dateFrom: "",
  dateTo: "",
  hasBank: "",
  hasPeopleList: "",
  status: "",
  registrar: "",
};

const FAMILY_OPTIONS = [
  { value: "yarane", label: "یارانه" },
  { value: "mostamari", label: "مستمری" },
];

const PAGE_SIZE_OPTIONS = [
  { value: "10", label: "۱۰" },
  { value: "15", label: "۱۵" },
  { value: "25", label: "۲۵" },
  { value: "50", label: "۵۰" },
];

const TRI_OPTIONS = [
  { value: "", label: "همه" },
  { value: "yes", label: "دارد" },
  { value: "no", label: "ندارد" },
];

const STATUS_OPTIONS = [
  { value: "", label: "همه" },
  { value: "approved", label: "تاییدشده" },
  { value: "draft", label: "پیش‌نویس" },
];

type UserHit = {
  id: number;
  username: string;
  displayName?: string;
  role: string;
  isAdmin?: boolean;
};

/** Search + page size — sits above the table (header toolbar). */
export function TxnTableToolbar({
  value,
  onChange,
  onApply,
}: {
  value: TxnFilterValues;
  onChange: (next: TxnFilterValues) => void;
  onApply: (next?: TxnFilterValues) => void;
  loading?: boolean;
}) {
  function patch(partial: Partial<TxnFilterValues>) {
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
        <label htmlFor="txn-toolbar-q">جستجو</label>
        <input
          id="txn-toolbar-q"
          value={value.q}
          onChange={(e) => patch({ q: e.target.value })}
          placeholder="عنوان، شناسه، ثبت‌کننده…"
        />
      </div>
      <UiSelect
        id="txn-toolbar-ps"
        label="در صفحه"
        value={String(value.pageSize)}
        options={PAGE_SIZE_OPTIONS}
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

function RegistrarSuggest({
  value,
  onChange,
  onPick,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (username: string) => void;
}) {
  const [hits, setHits] = useState<UserHit[]>([]);
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

  useEffect(() => {
    if (pickedRef.current) {
      pickedRef.current = false;
      setHits([]);
      setOpen(false);
      return;
    }
    const q = value.trim();
    if (q.length < 1) {
      setHits([]);
      setOpen(false);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/settings/users?q=${encodeURIComponent(q)}&limit=20`,
        );
        const data = await res.json();
        if (res.ok && data.ok) {
          const users = (data.users || []) as UserHit[];
          setHits(users);
          setOpen(users.length > 0);
        } else {
          setHits([]);
          setOpen(false);
        }
      } catch {
        setHits([]);
        setOpen(false);
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => clearTimeout(t);
  }, [value]);

  function pick(u: UserHit) {
    pickedRef.current = true;
    onPick(u.username);
    setHits([]);
    setOpen(false);
  }

  function labelOf(u: UserHit) {
    const name = (u.displayName || "").trim();
    if (name && name.toLowerCase() !== u.username.toLowerCase()) return name;
    return u.username;
  }

  return (
    <div className="field registrar-suggest" ref={wrapRef}>
      <label htmlFor="txn-filter-registrar">ثبت‌کننده</label>
      <div className="registrar-suggest__wrap">
        <input
          id="txn-filter-registrar"
          className="ui-input"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (hits.length) setOpen(true);
          }}
          placeholder="نام، نام کاربری یا نقش…"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
        />
        {searching ? (
          <span className="registrar-suggest__spinner">
            <LoadingSpinner size="sm" inline label={null} />
          </span>
        ) : null}
        {open && hits.length > 0 ? (
          <ul className="registrar-suggest__menu" role="listbox">
            {hits.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  className="registrar-suggest__option"
                  onClick={() => pick(u)}
                >
                  <span className="registrar-suggest__name">{labelOf(u)}</span>
                  <span className="registrar-suggest__meta">
                    {u.username}
                    {u.role ? ` · ${u.role}` : ""}
                    {u.isAdmin ? " · ادمین" : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

/** Side filters only (type, dates, bank, people list, registrar). */
export function TxnFilterBar({
  value,
  onChange,
  onApply,
  hidePeopleList,
  clearDefaults,
}: {
  value: TxnFilterValues;
  onChange: (next: TxnFilterValues) => void;
  onApply: (next?: TxnFilterValues) => void;
  loading?: boolean;
  hidePeopleList?: boolean;
  /** Extra fields kept when «پاک کردن» (e.g. home defaults to تاییدشده). */
  clearDefaults?: Partial<TxnFilterValues>;
}) {
  const yaraneTypeOptions = useMemo(() => {
    const all = [...YARANE_DOC_TYPES, ...YARANE_EXTRA_TYPES];
    const sorted = all
      .slice()
      .sort((a, b) => a.shortFa.localeCompare(b.shortFa, "fa"));
    return sorted.map((t) => ({
      value: String(t.supplyLocationId),
      label: t.shortFa,
      title: t.titleFa,
    }));
  }, []);

  const mostamariOptions = useMemo(() => mostamariTypeOptions(), []);
  const isMostamari = value.family === "mostamari";

  function patch(partial: Partial<TxnFilterValues>) {
    onChange({ ...value, ...partial });
  }

  function applyPatch(partial: Partial<TxnFilterValues>) {
    const next = { ...value, ...partial };
    onChange(next);
    onApply(next);
  }

  const statusDefault = clearDefaults?.status ?? "";
  const activeCount = [
    value.family && value.family !== (clearDefaults?.family ?? "yarane")
      ? "1"
      : "",
    isMostamari
      ? value.mostamariTypeIds.length
        ? "1"
        : ""
      : value.supplyLocationIds.length
        ? "1"
        : "",
    value.dateFrom,
    value.dateTo,
    value.hasBank,
    hidePeopleList ? "" : value.hasPeopleList,
    value.status !== statusDefault ? "1" : "",
    value.registrar.trim(),
  ].filter(Boolean).length;

  return (
    <form
      className="txn-filter"
      onSubmit={(e) => {
        e.preventDefault();
        onApply(value);
      }}
    >
      <UiSelect
        id="txn-filter-family"
        label="خانواده دیسکت"
        value={value.family || "yarane"}
        options={FAMILY_OPTIONS}
        onChange={(v) =>
          applyPatch({
            family: (v === "mostamari" ? "mostamari" : "yarane") as TxnFamilyFilter,
            // Clear the other family's type picks when switching
            supplyLocationIds: v === "mostamari" ? [] : value.supplyLocationIds,
            mostamariTypeIds: v === "mostamari" ? value.mostamariTypeIds : [],
          })
        }
      />

      {isMostamari ? (
        <UiSelect
          id="txn-filter-mst-type"
          label="نوع مستمری"
          multiple
          value={value.mostamariTypeIds}
          options={mostamariOptions}
          onChange={(ids) => applyPatch({ mostamariTypeIds: ids })}
          placeholder="همه انواع مستمری"
          searchable
          searchPlaceholder="جستجوی نوع مستمری…"
        />
      ) : (
        <UiSelect
          id="txn-filter-type"
          label="نوع / محل تأمین"
          multiple
          value={value.supplyLocationIds}
          options={yaraneTypeOptions}
          onChange={(ids) => applyPatch({ supplyLocationIds: ids })}
          placeholder="همه انواع یارانه"
          searchable
          searchPlaceholder="جستجوی نوع…"
        />
      )}

      <PersianDatePicker
        id="txn-filter-from"
        label="از تاریخ"
        value={value.dateFrom}
        onChange={(v) => patch({ dateFrom: v })}
      />

      <PersianDatePicker
        id="txn-filter-to"
        label="تا تاریخ"
        value={value.dateTo}
        onChange={(v) => patch({ dateTo: v })}
      />

      <UiSelect
        id="txn-filter-status"
        label="وضعیت"
        value={value.status}
        options={STATUS_OPTIONS}
        onChange={(v) =>
          applyPatch({
            status: (v === "approved" || v === "draft" ? v : "") as TxnStatusFilter,
            // Status owns Key2/acceptance; clear the overlapping people-list tri
            hasPeopleList: "",
          })
        }
      />

      <UiSelect
        id="txn-filter-bank"
        label="دیسکت بانک"
        value={value.hasBank}
        options={TRI_OPTIONS}
        onChange={(v) => patch({ hasBank: v as TriFilter })}
      />

      {!hidePeopleList ? (
        <UiSelect
          id="txn-filter-people"
          label="لیست افراد"
          value={value.hasPeopleList}
          options={TRI_OPTIONS}
          onChange={(v) =>
            patch({
              hasPeopleList: v as TriFilter,
              status: "",
            })
          }
        />
      ) : null}

      <RegistrarSuggest
        value={value.registrar}
        onChange={(v) => patch({ registrar: v })}
        onPick={(username) => applyPatch({ registrar: username })}
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
            const cleared = {
              ...EMPTY_TXN_FILTERS,
              ...clearDefaults,
              q: value.q,
              pageSize: value.pageSize,
              family: clearDefaults?.family ?? value.family,
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

/** Build query-string params from filter values (excluding page). */
export function txnFiltersToParams(
  filters: TxnFilterValues,
  extra?: Record<string, string>,
) {
  const params = new URLSearchParams(extra);
  params.set("pageSize", String(filters.pageSize));
  const family = filters.family === "mostamari" ? "mostamari" : "yarane";
  params.set("family", family);
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (family === "yarane" && filters.supplyLocationIds.length) {
    params.set("supplyLocationIds", filters.supplyLocationIds.join(","));
  }
  if (family === "mostamari" && filters.mostamariTypeIds.length) {
    params.set("mostamariTypeIds", filters.mostamariTypeIds.join(","));
  }
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.hasBank) params.set("hasBank", filters.hasBank);
  if (filters.status === "approved" || filters.status === "draft") {
    params.set("status", filters.status);
  }
  if (filters.hasPeopleList) params.set("hasPeopleList", filters.hasPeopleList);
  if (filters.registrar.trim()) params.set("registrar", filters.registrar.trim());
  return params;
}
