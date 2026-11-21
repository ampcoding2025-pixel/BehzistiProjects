"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigation } from "@/config/navigation";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-72 shrink-0 flex-col overflow-hidden bg-[var(--sidebar)] text-[var(--sidebar-fg)]">
      <div className="flex flex-col items-center gap-2 border-b border-white/10 px-4 py-5 text-center">
        <Image
          src="/behzisti-logo.png"
          alt="لوگوی بهزیستی"
          width={162}
          height={44}
          className="h-11 w-auto object-contain"
          priority
        />
        <div className="mt-1">
          <div className="text-sm font-semibold">داشبورد مدیریتی دیدبان</div>
          <div className="text-[11px] text-[var(--sidebar-muted)]">سازمان بهزیستی کشور</div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navigation.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.id}
              href={item.href}
              prefetch
              aria-current={active ? "page" : undefined}
              className={cn(
                "block rounded-md px-3 py-2.5 transition",
                active ? "bg-white/10 text-white" : "text-[var(--sidebar-fg)] hover:bg-white/5",
              )}
            >
              <div className="text-sm font-medium">{item.label}</div>
              <div className="mt-0.5 text-[11px] text-[var(--sidebar-muted)]">{item.purpose}</div>
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 px-4 py-3 text-[11px] text-[var(--sidebar-muted)]">
        پورت ۳۰۰۱ · داده فقط‌خواندنی دیدبان
      </div>
    </aside>
  );
}
