"use client";

import type { ReactNode } from "react";
import { LoadingSpinner } from "@/components/LoadingSpinner";

function LoadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 12a8 8 0 0 1 14.4-4.8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M20 12a8 8 0 0 1-14.4 4.8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M18.5 3.5v4h-4M5.5 20.5v-4h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** People/list icon for «لیست افراد». */
export function ListFieldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 6h13M8 12h13M8 18h13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="4" cy="6" r="1.25" fill="currentColor" />
      <circle cx="4" cy="12" r="1.25" fill="currentColor" />
      <circle cx="4" cy="18" r="1.25" fill="currentColor" />
    </svg>
  );
}

/** Bank/building icon for «دیسکت بانک». */
export function BankFieldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 10.5 12 4l9 6.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 10.5V18M9.5 10.5V18M14.5 10.5V18M19 10.5V18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M3 18h18M2 21h20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Icon (or dash+load) until the user requests the value. */
export function LazyDashCell(props: {
  loaded: boolean;
  loading?: boolean;
  children?: ReactNode;
  onLoad: () => void;
  title: string;
  /** Custom trigger icon (no dash). Defaults to refresh + dash. */
  icon?: ReactNode;
  /** When true and no custom icon, show only refresh (no dash). */
  iconOnly?: boolean;
}) {
  const { loaded, loading, children, onLoad, title, icon, iconOnly } = props;

  if (loading) {
    return (
      <span
        className="inline-flex items-center gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        <LoadingSpinner size="sm" inline />
      </span>
    );
  }

  if (loaded) {
    return <span>{children}</span>;
  }

  return (
    <button
      type="button"
      className="inline-flex items-center justify-center gap-1 text-[var(--ink-soft)] hover:text-[var(--brand)]"
      title={title}
      aria-label={title}
      onClick={(e) => {
        e.stopPropagation();
        onLoad();
      }}
    >
      {icon ? icon : iconOnly ? <LoadIcon /> : (
        <>
          <span>—</span>
          <LoadIcon />
        </>
      )}
    </button>
  );
}

export function LazyPayedRowsCell(props: {
  value: number | null | undefined;
  loading?: boolean;
  onLoad: () => void;
  title?: string;
}) {
  const loaded = typeof props.value === "number" && Number.isFinite(props.value);
  return (
    <LazyDashCell
      loaded={loaded}
      loading={props.loading}
      onLoad={props.onLoad}
      title={props.title || "بارگذاری تعداد ردیف محاسبه"}
      iconOnly
    >
      {loaded ? props.value!.toLocaleString("fa-IR") : null}
    </LazyDashCell>
  );
}
