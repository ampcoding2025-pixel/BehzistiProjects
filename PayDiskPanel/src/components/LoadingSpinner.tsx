"use client";

type Size = "sm" | "md" | "lg";

const SIZE_PX: Record<Size, number> = {
  sm: 18,
  md: 28,
  lg: 40,
};

export function LoadingSpinner({
  label = "در حال بارگذاری…",
  size = "md",
  className = "",
  inline = false,
}: {
  label?: string | null;
  size?: Size;
  className?: string;
  /** Compact row for buttons / toolbars */
  inline?: boolean;
}) {
  const px = SIZE_PX[size];
  return (
    <div
      className={`loading-spinner ${inline ? "loading-spinner--inline" : ""} ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span
        className="loading-spinner__ring"
        style={{ width: px, height: px, borderWidth: Math.max(2, Math.round(px / 10)) }}
        aria-hidden
      />
      {label ? <span className="loading-spinner__label">{label}</span> : null}
      <span className="sr-only">{label || "در حال بارگذاری"}</span>
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
