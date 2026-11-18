import { KnowledgeSources } from "./KnowledgeSources";
import { SupportChatWidget } from "@/widget";

export default function KnowledgePage() {
  return (
    <>
      <KnowledgeSources />

      {/* Keep previous chat widget */}
      <SupportChatWidget
        apiBaseUrl=""
        appId="behzisti-portal"
        title="سامانه هوشمند پاسخگویی و پشتیبانی سازمانی"
        subtitle="دانش سازمانی · بخشنامه · قانون · FAQ دیده‌بان"
        position="bottom-right"
        primaryColor="#00BAD1"
      />
    </>
  );
}
