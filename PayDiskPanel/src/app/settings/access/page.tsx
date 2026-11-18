import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { AccessSettingsPanel } from "@/components/AccessSettingsPanel";

export default function SettingsAccessPage() {
  return (
    <AppShell
      crumbs={[
        { label: "پنل", href: "/" },
        { label: "تنظیمات", href: "/settings/access" },
        { label: "اعطای دسترسی" },
      ]}
    >
      <Suspense fallback={<div className="text-sm text-[var(--ink-soft)] py-6">بارگذاری…</div>}>
        <AccessSettingsPanel />
      </Suspense>
    </AppShell>
  );
}
