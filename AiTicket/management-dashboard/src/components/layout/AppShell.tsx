import { SupportChatMount } from "@/components/support-chat/SupportChatMount";
import { FilterProvider } from "@/data/FilterContext";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";

export function AppShell({
  children,
  updatedAt,
}: {
  children: React.ReactNode;
  updatedAt?: string;
}) {
  return (
    <FilterProvider>
      <div className="flex h-screen overflow-hidden bg-[var(--canvas)]">
        <Sidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <TopBar updatedAt={updatedAt} />
          <main className="min-h-0 flex-1 overflow-y-auto p-5">{children}</main>
        </div>
        <SupportChatMount />
      </div>
    </FilterProvider>
  );
}
