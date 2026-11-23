"use client";

type Size = "sm" | "md" | "lg";

const SIZE_PX: Record<Size, number> = {
  sm: 16,
  md: 28,
  lg: 40,
};

export function LoadingSpinner({
  label,
  size = "md",
  className = "",
  inline = false,
}: {
  /** Visible text under/beside the ring. Inline defaults to circle-only. */
  label?: string | null;
  size?: Size;
  className?: string;
  /** Compact circle for buttons / toolbars (no visible text). */
  inline?: boolean;
}) {
  const px = SIZE_PX[size];
  const visibleLabel =
    label === undefined ? (inline ? null : "در حال بارگذاری…") : label;
  const a11y = visibleLabel || label || "در حال بارگذاری";

  return (
    <div
      className={`loading-spinner ${inline ? "loading-spinner--inline" : ""} ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span
        className="loading-spinner__ring"
        style={{
          width: px,
          height: px,
          borderWidth: Math.max(2, Math.round(px / 8)),
        }}
        aria-hidden
      />
      {visibleLabel ? (
        <span className="loading-spinner__label">{visibleLabel}</span>
      ) : null}
      <span className="sr-only">{a11y}</span>
    </div>
  );
}

/** Full-block placeholder for table / panel wait states */
export function LoadingBlock({
  label = "در حال بارگذاری…",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div className={`loading-block ${className}`.trim()}>
      <LoadingSpinner label={label} size="lg" />
    </div>
  );
}
