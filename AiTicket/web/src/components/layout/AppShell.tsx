import { DemoBanner } from "@/components/layout/DemoBanner";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { SupportChatMount } from "@/components/support-chat/SupportChatMount";
import { DashboardFilterProvider } from "@/data/DashboardFilterContext";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <DashboardFilterProvider>
      <div className="fixed inset-0 flex min-h-0 flex-col overflow-hidden bg-[var(--canvas)]">
        <div className="shrink-0">
          <DemoBanner />
        </div>
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <Sidebar />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div className="sticky top-0 z-30 shrink-0">
              <Header />
            </div>
            <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">
              {children}
            </main>
          </div>
        </div>
        <SupportChatMount />
      </div>
    </DashboardFilterProvider>
  );
}
