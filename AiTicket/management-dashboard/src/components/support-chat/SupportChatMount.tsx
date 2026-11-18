"use client";

import { SupportChatWidget } from "./SupportChatWidget";

/**
 * Uses same-origin Next API routes (/api/chat, /api/knowledge) backed by OpenRouter.
 * Override with NEXT_PUBLIC_SUPPORT_BOT_URL only if an external bot is required.
 */
const BOT_URL = (process.env.NEXT_PUBLIC_SUPPORT_BOT_URL ?? "").replace(/\/$/, "");

export function SupportChatMount() {
  return (
    <SupportChatWidget
      apiBaseUrl={BOT_URL || ""}
      appId="aiticket-management"
      title="دستیار داشبورد مدیریتی دیدبان"
      subtitle="پاسخ بر اساس شاخص‌های زنده و OpenRouter"
      position="bottom-right"
      primaryColor="#00BAD1"
      logoSrc="/behzisti-logo.png"
      userLabel="مدیر داشبورد"
      showFaqs
    />
  );
}
