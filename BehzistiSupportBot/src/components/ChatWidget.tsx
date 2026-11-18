"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage, SessionStatus } from "@/lib/types";

const STATUS_LABEL: Record<SessionStatus, string> = {
  bot: "پاسخ‌گویی هوشمند",
  waiting_agent: "در انتظار کارشناس",
  with_agent: "متصل به کارشناس",
  closed: "بسته شده",
};

export function ChatWidget() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<SessionStatus>("bot");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [handoffSuggested, setHandoffSuggested] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!sessionId) return;
    if (status !== "waiting_agent" && status !== "with_agent") return;
    const t = setInterval(async () => {
      const res = await fetch(`/api/chat?sessionId=${sessionId}`);
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages);
      setStatus(data.status);
    }, 2500);
    return () => clearInterval(t);
  }, [sessionId, status]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setInput("");
    const optimistic: ChatMessage = {
      id: `tmp-${Date.now()}`,
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا");

      setSessionId(data.sessionId);
      setStatus(data.status);
      setHandoffSuggested(Boolean(data.handoffSuggested));

      const full = await fetch(`/api/chat?sessionId=${data.sessionId}`);
      const session = await full.json();
      setMessages(session.messages);
      setStatus(session.status);
    } catch {
      setMessages((m) => [
        ...m,
        {
          id: `err-${Date.now()}`,
          role: "system",
          content: "ارسال پیام با خطا روبه‌رو شد. لطفاً دوباره تلاش کنید.",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function requestHandoff() {
    if (!sessionId || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request", sessionId }),
      });
      const session = await res.json();
      setMessages(session.messages);
      setStatus(session.status);
      setHandoffSuggested(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="status-bar">
        <span
          className={`badge ${
            status === "with_agent" ? "ok" : status === "waiting_agent" ? "warn" : ""
          }`}
        >
          وضعیت: {STATUS_LABEL[status]}
        </span>
        {(handoffSuggested || status === "bot") && status !== "with_agent" && (
          <button className="btn warn" type="button" disabled={busy || !sessionId} onClick={requestHandoff}>
            اتصال به کارشناس زنده
          </button>
        )}
      </div>

      <div className="chat-panel">
        <div className="messages" aria-live="polite">
          {messages.length === 0 && (
            <div className="bubble assistant">
              سلام، به سامانه هوشمند پاسخگویی و پشتیبانی سازمانی خوش آمدید. سؤال خود را بنویسید.
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`bubble ${m.role}`}>
              {m.content}
              {typeof m.confidence === "number" && m.role === "assistant" && (
                <div className="meta">اطمینان پاسخ: {Math.round(m.confidence * 100)}٪</div>
              )}
              {m.sources && m.sources.length > 0 && (
                <div className="sources">
                  {m.sources.map((s) => (
                    <span key={s.id} className="chip">
                      {s.source === "faq" ? "FAQ" : s.source === "circular" ? "بخشنامه" : "قانون"} · {s.title}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="سؤال خود را بنویسید… (مثلاً شرایط مستمری یا ثبت‌نام سامانه)"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
          />
          <button className="btn" type="submit" disabled={busy || !input.trim()}>
            ارسال
          </button>
        </form>
      </div>
    </>
  );
}
