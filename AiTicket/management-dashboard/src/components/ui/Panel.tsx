import type { ReactNode } from "react";

export function Panel({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[var(--border)] bg-white shadow-[var(--card-shadow)]">
      <header className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
        <div>
          <h3 className="text-[14px] font-semibold text-[var(--foreground)]">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-[12px] text-[var(--muted)]">{subtitle}</p> : null}
        </div>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}
