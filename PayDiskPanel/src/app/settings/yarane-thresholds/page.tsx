"use client";

import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { YaraneThresholdsPanel } from "@/components/YaraneThresholdsPanel";

export default function YaraneThresholdsSettingsPage() {
  return (
    <AppShell
      crumbs={[
        { label: "پنل", href: "/" },
        { label: "تنظیمات", href: "/settings/access" },
        { label: "مبالغ یارانه" },
      ]}
    >
      <div className="space-y-4 max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-[family-name:var(--font-display)] text-2xl">
            مبالغ یارانه (سقف و کف)
          </h1>
          <Link href="/settings/mostamari-rates" className="btn btn-ghost">
            مبالغ مستمری
          </Link>
        </div>
        <YaraneThresholdsPanel />
      </div>
    </AppShell>
  );
}
