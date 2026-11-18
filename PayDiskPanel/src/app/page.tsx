import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { ApprovedTransactionsPanel } from "@/components/ApprovedTransactionsPanel";
import { LoadingBlock } from "@/components/LoadingSpinner";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <AppShell
      crumbs={[
        { label: "پنل", href: "/" },
        { label: "تراکنش‌ها", href: "/" },
        { label: "لیست تراکنش‌ها" },
      ]}
    >
      <Suspense fallback={<LoadingBlock label="بارگذاری لیست…" />}>
        <ApprovedTransactionsPanel />
      </Suspense>
    </AppShell>
  );
}
