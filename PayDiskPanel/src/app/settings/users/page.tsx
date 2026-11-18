import { AppShell } from "@/components/AppShell";
import { AccessUsersListPanel } from "@/components/AccessUsersListPanel";

export default function SettingsUsersPage() {
  return (
    <AppShell
      crumbs={[
        { label: "پنل", href: "/" },
        { label: "تنظیمات", href: "/settings/access" },
        { label: "فهرست کاربران" },
      ]}
    >
      <AccessUsersListPanel />
    </AppShell>
  );
}
