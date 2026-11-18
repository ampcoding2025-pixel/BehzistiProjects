import { AppShell } from "@/components/AppShell";
import { ReportsPanel } from "@/components/ReportsPanel";

export const dynamic = "force-dynamic";

export default function ReportsPage() {
  return (
    <AppShell
      crumbs={[
        { label: "پنل", href: "/" },
        { label: "گزارش‌های بازرسی" },
      ]}
    >
      <ReportsPanel />
    </AppShell>
  );
}
