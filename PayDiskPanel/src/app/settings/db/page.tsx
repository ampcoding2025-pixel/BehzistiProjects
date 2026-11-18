import { AppShell } from "@/components/AppShell";
import { DbSettingsPanel } from "@/components/DbSettingsPanel";

export default function SettingsDbPage() {
  return (
    <AppShell
      crumbs={[
        { label: "پنل", href: "/" },
        { label: "تنظیمات", href: "/settings/access" },
        { label: "تنظیمات دیتابیس" },
      ]}
    >
      <DbSettingsPanel />
    </AppShell>
  );
}
