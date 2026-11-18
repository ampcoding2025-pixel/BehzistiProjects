"use client";

import { SupportChatWidget } from "./SupportChatWidget";

const BOT_URL =
  process.env.NEXT_PUBLIC_SUPPORT_BOT_URL?.replace(/\/$/, "") ||
  "http://localhost:3040";

/** Floating support chat wired to BehzistiSupportBot AI layer */
export function SupportChatMount() {
  return (
    <SupportChatWidget
      apiBaseUrl={BOT_URL}
      appId="aiticket-web"
      title="سامانه هوشمند پاسخگویی و پشتیبانی سازمانی"
      subtitle="دانش سازمانی مرتبط با داشبورد تحلیلی"
      position="bottom-right"
      primaryColor="#00BAD1"
      logoSrc="/behzisti-logo.svg"
      userLabel="کاربر داشبورد تحلیلی"
    />
  );
}
