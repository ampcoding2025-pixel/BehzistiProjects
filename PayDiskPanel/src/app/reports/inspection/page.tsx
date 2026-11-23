import { AppShell } from "@/components/AppShell";
import { ReportsPanel } from "@/components/ReportsPanel";

export const dynamic = "force-dynamic";

/** Previous catalog-style inspection reports (moved from /reports). */
export default function InspectionReportsPage() {
  return (
    <AppShell
      crumbs={[
        { label: "پنل", href: "/" },
        { label: "گزارش‌ها", href: "/reports" },
        { label: "گزارش‌های بازرسی" },
      ]}
    >
      <ReportsPanel />
    </AppShell>
  );
}
