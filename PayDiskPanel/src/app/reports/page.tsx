import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { ShebaDeviationsReportPanel } from "@/components/ShebaDeviationsReportPanel";
import { LoadingBlock } from "@/components/LoadingSpinner";

export const dynamic = "force-dynamic";

export default function ReportsPage() {
  return (
    <AppShell
      crumbs={[
        { label: "پنل", href: "/" },
        { label: "گزارش‌ها", href: "/reports" },
        { label: "مغایرت شبا" },
      ]}
    >
      <Suspense fallback={<LoadingBlock label="بارگذاری گزارش…" />}>
        <ShebaDeviationsReportPanel />
      </Suspense>
    </AppShell>
  );
}
