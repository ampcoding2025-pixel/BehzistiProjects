import { AppShell } from "@/components/AppShell";
import { ArmaghanTransactionsPanel } from "@/components/ArmaghanTransactionsPanel";

export default function TransactionsPage() {
  return (
    <AppShell
      crumbs={[
        { label: "پنل", href: "/" },
        { label: "تراکنش‌ها", href: "/" },
        { label: "تراکنش‌های ارمغان" },
      ]}
    >
      <ArmaghanTransactionsPanel />
    </AppShell>
  );
}
