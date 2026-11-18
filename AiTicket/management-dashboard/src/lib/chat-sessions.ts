import type { WidgetMessage, WidgetSessionStatus } from "@/components/support-chat/types";

export type ChatSession = {
  id: string;
  status: WidgetSessionStatus;
  messages: WidgetMessage[];
  appId: string;
};

const globalStore = globalThis as typeof globalThis & {
  __mgmtChatSessions?: Map<string, ChatSession>;
};

function store() {
  if (!globalStore.__mgmtChatSessions) {
    globalStore.__mgmtChatSessions = new Map();
  }
  return globalStore.__mgmtChatSessions;
}

export function getOrCreateSession(sessionId: string | null | undefined, appId: string): ChatSession {
  if (sessionId) {
    const existing = store().get(sessionId);
    if (existing) return existing;
  }
  const id = sessionId || `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const session: ChatSession = {
    id,
    status: "bot",
    appId,
    messages: [
      {
        id: "welcome",
        role: "assistant",
        content:
          "سلام. دستیار داشبورد مدیریتی دیدبان هستم. درباره شاخص‌ها، پرونده‌های باز، موضوعات، استان‌ها یا کیفیت داده بپرسید.",
        createdAt: new Date().toISOString(),
      },
    ],
  };
  store().set(id, session);
  return session;
}

export function getSession(sessionId: string): ChatSession | null {
  return store().get(sessionId) ?? null;
}

export function appendMessage(session: ChatSession, message: WidgetMessage) {
  session.messages = [...session.messages, message];
  store().set(session.id, session);
}
