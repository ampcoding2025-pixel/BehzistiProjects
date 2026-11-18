"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { MostamariWizard } from "@/components/MostamariWizard";
import { YaraneWizard } from "@/components/YaraneWizard";

function WizardKeyed() {
  const sp = useSearchParams();
  const family = (sp.get("family") || "").toLowerCase();
  const key = `${family || "yarane"}-${sp.get("trId") || "new"}-${sp.get("type") || ""}`;
  if (family === "mostamari") {
    return <MostamariWizard key={key} />;
  }
  return <YaraneWizard key={key} />;
}

function Crumbs() {
  const sp = useSearchParams();
  const family = (sp.get("family") || "").toLowerCase();
  const trId = sp.get("trId");
  return (
    <AppShell
      crumbs={[
        { label: "پنل", href: "/" },
        {
          label: family === "mostamari" ? "مستمری" : "تراکنش‌ها",
          href: family === "mostamari" ? "/?family=mostamari" : "/",
        },
        {
          label:
            family === "mostamari"
              ? trId
                ? `ویزارد مستمری #${trId}`
                : "ویزارد مستمری"
              : trId
                ? `ویزارد یارانه #${trId}`
                : "تراکنش جدید",
        },
      ]}
    >
      <Suspense fallback={<div className="text-sm text-[var(--ink-soft)] py-8">بارگذاری…</div>}>
        <WizardKeyed />
      </Suspense>
    </AppShell>
  );
}

export default function NewRequestPage() {
  return (
    <Suspense fallback={<div className="text-sm text-[var(--ink-soft)] py-8">بارگذاری…</div>}>
      <Crumbs />
    </Suspense>
  );
}
