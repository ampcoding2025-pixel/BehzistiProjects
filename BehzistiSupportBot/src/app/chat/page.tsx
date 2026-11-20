import { SupportChatWidget } from "@/widget";
import { ChatWidget } from "@/components/ChatWidget";

export default function ChatPage() {
  return (
    <>
      <section className="hero">
        <h2>سامانه هوشمند پاسخگویی و پشتیبانی سازمانی</h2>
        <p>
          کامپوننت گفتگو به لایه دانش / مدل هوش مصنوعی وصل می‌شود و با{" "}
          <code>appId</code> فقط دانش مرتبط همان برنامه را برای پاسخ استفاده می‌کند. دکمه شناور
          پایین صفحه همان ویجت قابل‌نصب در اپ‌های دیگر است.
        </p>
      </section>

      <ChatWidget />

      {/* Reusable floating widget — drop this into any host app */}
      <SupportChatWidget
        apiBaseUrl=""
        appId="behzisti-portal"
        title="سامانه هوشمند پاسخگویی و پشتیبانی سازمانی"
        subtitle="دانش سازمانی · بخشنامه · قانون · FAQ"
        position="bottom-right"
        primaryColor="#00BAD1"
      />
    </>
  );
}
