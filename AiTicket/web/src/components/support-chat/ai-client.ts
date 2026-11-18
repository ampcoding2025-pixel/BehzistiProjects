import type { ChatSendResponse, SupportChatConfig, WidgetMessage, WidgetSessionStatus } from "./types";

function joinUrl(base: string, path: string) {
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

export type FaqItem = {
  id: string;
  title: string;
  question: string;
  answerPreview?: string;
  tags?: string[];
  category?: string;
};

export type AiClient = {
  sendMessage: (args: {
    sessionId: string | null;
    message: string;
    userLabel?: string;
  }) => Promise<ChatSendResponse>;
  getSession: (sessionId: string) => Promise<{
    id: string;
    status: WidgetSessionStatus;
    messages: WidgetMessage[];
  }>;
  requestHandoff: (sessionId: string) => Promise<{
    id: string;
    status: WidgetSessionStatus;
    messages: WidgetMessage[];
  }>;
  listFaqs: (limit?: number) => Promise<FaqItem[]>;
};

export function createAiClient(config: SupportChatConfig): AiClient {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    "X-App-Id": config.appId,
    ...(config.headers ?? {}),
  };

  return {
    async sendMessage({ sessionId, message, userLabel }) {
      const res = await fetch(joinUrl(config.apiBaseUrl, "/api/chat"), {
        method: "POST",
        headers,
        body: JSON.stringify({
          sessionId,
          message,
          userLabel: userLabel ?? config.userLabel,
          appId: config.appId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا در ارتباط با لایه هوش مصنوعی");
      return data as ChatSendResponse;
    },

    async getSession(sessionId) {
      const res = await fetch(
        joinUrl(config.apiBaseUrl, `/api/chat?sessionId=${encodeURIComponent(sessionId)}&appId=${encodeURIComponent(config.appId)}`),
        { headers },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "جلسه پیدا نشد");
      return data;
    },

    async requestHandoff(sessionId) {
      const res = await fetch(joinUrl(config.apiBaseUrl, "/api/handoff"), {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "request",
          sessionId,
          appId: config.appId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا در ارجاع به کارشناس");
      return data;
    },

    async listFaqs(limit = 12) {
      const q = new URLSearchParams({
        appId: config.appId,
        source: "faq",
        corpus: "didban",
        limit: String(limit),
      });
      const res = await fetch(joinUrl(config.apiBaseUrl, `/api/knowledge?${q}`), {
        headers,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا در دریافت FAQ");
      return (data.faqs ?? []) as FaqItem[];
    },
  };
}
