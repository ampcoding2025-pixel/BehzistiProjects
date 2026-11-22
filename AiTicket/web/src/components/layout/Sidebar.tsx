"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { navigation, maturityLabel, type NavMaturity } from "@/config/navigation";
import { cn } from "@/lib/utils";

function MaturityBadge({ maturity }: { maturity: NavMaturity }) {
  const styles: Record<NavMaturity, string> = {
    active: "bg-emerald-100 text-emerald-800",
    mock: "bg-sky-100 text-sky-800",
    planned: "bg-slate-100 text-slate-500",
  };
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", styles[maturity])}>
      {maturityLabel[maturity]}
    </span>
  );
}

const linkBase =
  "flex items-center justify-between gap-2 rounded-md px-2.5 py-2 text-sm transition-colors text-slate-700 hover:bg-slate-100";

export function Sidebar() {
  const pathname = usePathname();
  // Active styles only after mount — avoids SSR/client className mismatch with
  // cacheComponents / partialPrefetching when the shell and route disagree briefly.
  const [activePath, setActivePath] = useState<string | null>(null);
  useEffect(() => {
    setActivePath(pathname);
  }, [pathname]);

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col overflow-hidden border-l border-[var(--border)] bg-[var(--sidebar)] text-[var(--sidebar-fg)]">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-[var(--border)] px-3">
        <Image
          src="/behzisti-logo.png"
          alt="لوگوی سازمان بهزیستی کشور"
          width={28}
          height={28}
          priority
          className="h-7 w-7 shrink-0 object-contain"
        />
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[11px] font-semibold text-slate-800">سازمان بهزیستی</p>
          <p className="truncate text-[10px] text-slate-500">هوش تحلیلی</p>
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {navigation.map((group) => (
          <div key={group.id} className="mb-5">
            <div className="mb-2 px-2 text-[11px] font-semibold text-[var(--muted)]">
              {group.label}
            </div>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const active = activePath === item.href;
                const disabled = item.maturity === "planned";
                return (
                  <li key={item.id}>
                    {disabled ? (
                      <div
                        className="flex items-center justify-between gap-2 rounded-md px-2.5 py-2 text-sm text-slate-400"
                        title="قابلیت برنامه‌ریزی‌شده"
                      >
                        <span>{item.label}</span>
                        <MaturityBadge maturity={item.maturity} />
                      </div>
                    ) : (
                      <Link
                        href={item.href}
                        className={cn(
                          linkBase,
                          active && "bg-[var(--brand-soft)] font-semibold text-[var(--brand)]",
                        )}
                      >
                        <span>{item.label}</span>
                        <MaturityBadge maturity={item.maturity} />
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
