"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export type UiSelectOption = {
  value: string;
  label: string;
  title?: string;
};

type CommonProps = {
  id?: string;
  label?: string;
  options: UiSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
};

type SingleProps = CommonProps & {
  multiple?: false;
  value: string;
  onChange: (value: string) => void;
};

type MultiProps = CommonProps & {
  multiple: true;
  value: string[];
  onChange: (value: string[]) => void;
};

export function UiSelect(props: SingleProps | MultiProps) {
  const {
    id,
    label,
    options,
    placeholder = "انتخاب…",
    disabled,
    searchable = false,
    searchPlaceholder = "جستجو…",
  } = props;
  const multiple = !!props.multiple;
  const autoId = useId();
  const fieldId = id || autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const selectedValues = multiple
    ? (props as MultiProps).value
    : [(props as SingleProps).value].filter((v) => v !== "" && v != null);

  const selectedOpts = options.filter(
    (o) => o.value !== "" && selectedValues.includes(o.value),
  );

  const display = multiple
    ? selectedOpts.length === 0
      ? placeholder
      : selectedOpts.length === 1
        ? selectedOpts[0]!.label
        : `${selectedOpts.length.toLocaleString("fa-IR")} نوع انتخاب‌شده`
    : options.find((o) => o.value === (props as SingleProps).value)?.label ||
      placeholder;

  const titleText = multiple
    ? selectedOpts.map((o) => o.label).join("، ") || placeholder
    : options.find((o) => o.value === (props as SingleProps).value)?.title ||
      display;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = multiple
      ? options.filter((o) => o.value !== "")
      : options;
    if (!needle) return list;
    return list.filter((o) => {
      const hay = `${o.label} ${o.title || ""} ${o.value}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [options, q, multiple]);

  useEffect(() => {
    if (!open) {
      setQ("");
      return;
    }
    if (searchable) {
      queueMicrotask(() => searchRef.current?.focus());
    }
  }, [open, searchable]);

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

  function toggleMulti(val: string) {
    const cur = (props as MultiProps).value;
    const next = cur.includes(val)
      ? cur.filter((v) => v !== val)
      : [...cur, val];
    (props as MultiProps).onChange(next);
  }

  return (
    <div className="field ui-select-field" ref={rootRef}>
      {label ? <label htmlFor={fieldId}>{label}</label> : null}
      <button
        id={fieldId}
        type="button"
        className={`ui-select-trigger${open ? " is-open" : ""}${
          multiple && selectedOpts.length ? " has-multi" : ""
        }`}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-multiselectable={multiple || undefined}
        title={titleText}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="ui-select-trigger__text">{display}</span>
        <span className="ui-select-trigger__chevron" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <div className="ui-select-menu-wrap">
          {searchable ? (
            <div className="ui-select-search">
              <input
                ref={searchRef}
                type="search"
                value={q}
                placeholder={searchPlaceholder}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                aria-label={searchPlaceholder}
              />
            </div>
          ) : null}
          <ul
            className="ui-select-menu"
            role="listbox"
            aria-labelledby={fieldId}
            aria-multiselectable={multiple || undefined}
          >
            {filtered.length === 0 ? (
              <li className="ui-select-empty">موردی یافت نشد</li>
            ) : (
              filtered.map((opt) => {
                const active = multiple
                  ? selectedValues.includes(opt.value)
                  : opt.value === (props as SingleProps).value;
                return (
                  <li key={opt.value || "__empty"}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={`ui-select-option${active ? " is-active" : ""}`}
                      title={opt.title || opt.label}
                      onClick={() => {
                        if (multiple) {
                          if (!opt.value) return;
                          toggleMulti(opt.value);
                        } else {
                          (props as SingleProps).onChange(opt.value);
                          setOpen(false);
                        }
                      }}
                    >
                      {multiple ? (
                        <span
                          className={`ui-select-check${active ? " is-on" : ""}`}
                          aria-hidden
                        >
                          {active ? "✓" : ""}
                        </span>
                      ) : null}
                      <span className="ui-select-option__body">
                        <span className="ui-select-option__label">
                          {opt.label}
                        </span>
                        {opt.title && opt.title !== opt.label ? (
                          <span className="ui-select-option__hint">
                            {opt.title}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
