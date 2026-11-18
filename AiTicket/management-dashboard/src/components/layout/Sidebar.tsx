"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { navigation } from "@/config/navigation";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();
  const [activePath, setActivePath] = useState<string | null>(null);
  useEffect(() => {
    setActivePath(pathname);
  }, [pathname]);

  return (
    <aside className="flex h-screen w-72 shrink-0 flex-col overflow-hidden bg-[var(--sidebar)] text-[var(--sidebar-fg)]">
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-5">
        <Image
          src="/behzisti-logo.png"
          alt="لوگوی بهزیستی"
          width={48}
          height={48}
          className="h-12 w-auto object-contain"
          priority
        />
        <div>
          <div className="text-sm font-semibold">داشبورد مدیریتی دیدبان</div>
          <div className="text-[11px] text-[var(--sidebar-muted)]">سازمان بهزیستی کشور</div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navigation.map((item) => {
          const active = activePath === item.href;
          return (
            <a
              key={item.id}
              href={item.href}
              className={cn(
                "block rounded-md px-3 py-2.5 transition",
                active ? "bg-white/10 text-white" : "text-[var(--sidebar-fg)] hover:bg-white/5",
              )}
            >
              <div className="text-sm font-medium">{item.label}</div>
              <div className="mt-0.5 text-[11px] text-[var(--sidebar-muted)]">{item.purpose}</div>
            </a>
          );
        })}
      </nav>
      <div className="border-t border-white/10 px-4 py-3 text-[11px] text-[var(--sidebar-muted)]">
        پورت ۳۰۰۱ · داده فقط‌خواندنی دیدبان
      </div>
    </aside>
  );
}
