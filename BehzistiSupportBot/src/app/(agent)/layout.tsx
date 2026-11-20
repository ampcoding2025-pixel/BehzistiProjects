import { KnowledgeSources } from "@/app/knowledge/KnowledgeSources";
import { SupportChatWidget } from "@/widget";

export default function AgentLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {/* Shell reads the URL; children keep Next.js routes active */}
      <KnowledgeSources />
      {children}

      <SupportChatWidget
        apiBaseUrl=""
        appId="behzisti-portal"
        logoSrc="/behzisti-logo.svg"
        title="سامانه هوشمند پاسخگویی و پشتیبانی سازمانی"
        subtitle="دانش سازمانی · بخشنامه · قانون · FAQ دیده‌بان"
        position="bottom-right"
        primaryColor="#00BAD1"
      />
    </>
  );
}
