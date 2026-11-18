"use client";

import { cn, formatFaDelta, formatFaNumber, formatFaPercent } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  unit,
  secondaryValue,
  secondaryUnit,
  previousValue,
  deltaPercent,
  tone,
  definition,
  confidence,
  href,
  hrefHint,
}: {
  label: string;
  value: number | null;
  unit: string;
  secondaryValue?: number | null;
  secondaryUnit?: string | null;
  previousValue?: number | null;
  deltaPercent?: number | null;
  tone: string;
  definition: string;
  confidence: string;
  href?: string;
  hrefHint?: string;
}) {
  const display =
    value == null
      ? "—"
      : unit === "percent"
        ? formatFaPercent(value)
        : unit === "days"
          ? `${formatFaNumber(value, 1)} روز`
          : formatFaNumber(value);

  const toneBorder =
    tone === "danger"
      ? "border-r-red-600"
      : tone === "warning"
        ? "border-r-orange-500"
        : tone === "positive"
          ? "border-r-green-600"
          : "border-r-blue-600";

  const deltaTone =
    deltaPercent == null
      ? "text-[var(--muted)]"
      : deltaPercent > 0
        ? "text-orange-700"
        : deltaPercent < 0
          ? "text-green-700"
          : "text-[var(--muted)]";

  const body = (
    <>
      <div className="text-[13px] font-medium text-slate-600">{label}</div>
      <div className="mt-2 flex items-end gap-2">
        <div className="text-[30px] font-bold leading-none text-[var(--foreground)]">{display}</div>
        {secondaryValue != null && secondaryUnit === "percent" ? (
          <div className="pb-1 text-sm text-[var(--muted)]">{formatFaPercent(secondaryValue)}</div>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px]">
        <span className={deltaTone}>
          نسبت به دوره قبل: {formatFaDelta(deltaPercent)}
          {previousValue != null
            ? ` (قبلی: ${
                unit === "percent"
                  ? formatFaPercent(previousValue)
                  : unit === "days"
                    ? formatFaNumber(previousValue, 1)
                    : formatFaNumber(previousValue)
              })`
            : ""}
        </span>
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{confidence}</span>
      </div>
      <p className="mt-2 text-[12px] leading-5 text-[var(--muted)]">{definition}</p>
      {hrefHint ? <div className="mt-2 text-[11px] font-medium text-blue-700">{hrefHint}</div> : null}
    </>
  );

  const className = cn(
    "block rounded-lg border border-[var(--border)] bg-white p-4 border-r-4 shadow-[var(--card-shadow)] text-right",
    toneBorder,
    href && "cursor-pointer transition hover:border-blue-300 hover:shadow-md",
  );

  if (href) {
    return (
      <a href={href} className={className}>
        {body}
      </a>
    );
  }

  return <article className={className}>{body}</article>;
}
