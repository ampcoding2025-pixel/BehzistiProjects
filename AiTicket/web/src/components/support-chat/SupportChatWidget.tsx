"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createAiClient, type FaqItem } from "./ai-client";
import type { SupportChatConfig, WidgetMessage, WidgetSessionStatus } from "./types";
import "./support-chat-widget.css";

const DEFAULT_WELCOME =
  "سلام! من دستیار دانش سازمانی هستم. سؤال خود را بپرسید یا یکی از پرسش‌های متداول زیر را انتخاب کنید.";

/** Fallback only from Didban frequent topics (not sample/AiTicket FAQs). */
const FALLBACK_FAQS: FaqItem[] = [
  {
    id: "didban-faq-001",
    title: "حق پرستاری",
    question: "وضعیت درخواست حق پرستاری برای معلولیت شدید چگونه پیگیری می‌شود؟",
  },
  {
    id: "didban-faq-009",
    title: "واریز مستمری",
    question: "چرا مستمری توانبخشی واریز نشده است؟",
  },
  {
    id: "didban-faq-003",
    title: "کمک موردی",
    question: "کمک موردی توانبخشی کی پرداخت می‌شود؟",
  },
  {
    id: "didban-faq-010",
    title: "وام اشتغال",
    question: "چرا وام اشتغال توانبخشی پرداخت یا تأیید نشد؟",
  },
];

export type SupportChatWidgetProps = SupportChatConfig & {
  className?: string;
  logoSrc?: string;
  /** Show FAQ list inside chat (default true) */
  showFaqs?: boolean;
};

export function SupportChatWidget(props: SupportChatWidgetProps) {
  const {
    apiBaseUrl,
    appId,
    title = "سامانه هوشمند پاسخگویی و پشتیبانی سازمانی",
    subtitle = "پاسخ بر اساس دانش مرتبط با این برنامه",
    userLabel,
    primaryColor = "#00BAD1",
    defaultOpen = false,
    position = "bottom-right",
    headers,
    onHandoff,
    className,
    logoSrc = "/behzisti-logo.png",
    showFaqs = true,
  } = props;

  const client = useMemo(
    () =>
      createAiClient({
        apiBaseUrl,
        appId,
        userLabel,
        headers,
      }),
    [apiBaseUrl, appId, userLabel, headers],
  );

  const [open, setOpen] = useState(defaultOpen);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WidgetMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: DEFAULT_WELCOME,
      createdAt: "0",
    },
  ]);
  const [status, setStatus] = useState<WidgetSessionStatus>("bot");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [handoffSuggested, setHandoffSuggested] = useState(false);
  const [faqs, setFaqs] = useState<FaqItem[]>(FALLBACK_FAQS);
  const [faqExpanded, setFaqExpanded] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const showFaqPanel = showFaqs && status === "bot" && messages.length <= 3 && !busy;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, faqs, faqExpanded]);

  useEffect(() => {
    if (!open || !showFaqs) return;
    let cancelled = false;
    (async () => {
      try {
        const items = await client.listFaqs(12);
        if (!cancelled && items.length) setFaqs(items);
      } catch {
        /* keep fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, showFaqs, client]);

  useEffect(() => {
    if (!sessionId || !open) return;
    if (status !== "waiting_agent" && status !== "with_agent") return;
    const t = setInterval(async () => {
      try {
        const data = await client.getSession(sessionId);
        setMessages(data.messages);
        setStatus(data.status);
      } catch {
        /* ignore poll errors */
      }
    }, 2500);
    return () => clearInterval(t);
  }, [sessionId, status, open, client]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setInput("");
    setMessages((m) => [
      ...m,
      {
        id: `tmp-${Date.now()}`,
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
      },
    ]);

    try {
      const data = await client.sendMessage({
        sessionId,
        message: trimmed,
        userLabel,
      });
      setSessionId(data.sessionId);
      setStatus(data.status);
      setHandoffSuggested(Boolean(data.handoffSuggested));
      if (data.handoffSuggested) onHandoff?.(data.sessionId);

      const session = await client.getSession(data.sessionId);
      setMessages(session.messages);
      setStatus(session.status);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          id: `err-${Date.now()}`,
          role: "system",
          content: err instanceof Error ? err.message : "خطا در ارتباط با لایه هوش مصنوعی",
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
      const session = await client.requestHandoff(sessionId);
      setMessages(session.messages);
      setStatus(session.status);
      setHandoffSuggested(false);
      onHandoff?.(sessionId);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          id: `err-${Date.now()}`,
          role: "system",
          content: err instanceof Error ? err.message : "خطا در ارجاع",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  const isRight = position === "bottom-right";
  const styleVars = {
    ["--bzw-primary" as string]: primaryColor,
    ["--bzw-primary-soft" as string]: `${primaryColor}40`,
  };

  const quickChips = faqs.slice(0, 4);
  const listItems = faqs.slice(0, 10);

  return (
    <div className={`bzw-root ${className ?? ""}`} style={styleVars} data-app-id={appId}>
      {open && (
        <section
          className={`bzw-panel ${isRight ? "is-right" : ""}`}
          role="dialog"
          aria-label={title}
        >
          <header className="bzw-header">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoSrc} alt="" />
            <div>
              <h3>{title}</h3>
              {subtitle ? <p>{subtitle}</p> : null}
            </div>
            <div className="bzw-header-actions">
              <button
                type="button"
                className="bzw-icon-btn"
                aria-label="بستن"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>
          </header>

          <div className="bzw-messages" aria-live="polite">
            {messages.map((m) => (
              <div key={m.id} className={`bzw-bubble ${m.role}`}>
                {m.content}
                {typeof m.confidence === "number" && m.role === "assistant" && (
                  <div className="bzw-meta">اطمینان: {Math.round(m.confidence * 100)}٪</div>
                )}
                {m.sources && m.sources.length > 0 && (
                  <div className="bzw-chips">
                    {m.sources.map((s) => (
                      <span key={s.id} className="bzw-chip">
                        {s.title}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {showFaqPanel && (
              <div className="bzw-faq">
                <div className="bzw-faq__head">
                  <h4 className="bzw-faq__title">پرسش‌های متداول دیده‌بان</h4>
                  <button
                    type="button"
                    className="bzw-faq__toggle"
                    onClick={() => setFaqExpanded((v) => !v)}
                  >
                    {faqExpanded ? "جمع کردن" : "نمایش لیست"}
                  </button>
                </div>

                <div className="bzw-faq__chips">
                  {quickChips.map((f) => (
                    <button
                      key={`chip-${f.id}`}
                      type="button"
                      className="bzw-faq__chip"
                      disabled={busy}
                      onClick={() => void send(f.question)}
                      title={f.title}
                    >
                      {f.title || f.question}
                    </button>
                  ))}
                </div>

                {faqExpanded && (
                  <div className="bzw-faq__list" style={{ marginTop: "0.55rem" }}>
                    {listItems.length === 0 ? (
                      <p className="bzw-faq__empty">فعلاً پرسشی ثبت نشده است.</p>
                    ) : (
                      listItems.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          className="bzw-faq__item"
                          disabled={busy}
                          onClick={() => void send(f.question)}
                        >
                          {f.question}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <footer className="bzw-footer">
            {sessionId && (handoffSuggested || status === "bot") && status !== "with_agent" ? (
              <div className="bzw-handoff">
                <span>پاسخ موردنظرتان را دریافت نکردید؟</span>
                <button
                  type="button"
                  className="bzw-btn ghost"
                  disabled={busy}
                  onClick={requestHandoff}
                >
                  گفتگو با پشتیبانی
                </button>
              </div>
            ) : null}
            <form
              className="bzw-composer"
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="سؤال خود را بنویسید…"
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
              />
              <button className="bzw-btn" type="submit" disabled={busy || !input.trim()}>
                ارسال
              </button>
            </form>
          </footer>
        </section>
      )}

      {!open && (
        <div className={`bzw-launcher-wrap ${isRight ? "is-right" : ""}`}>
          <button
            type="button"
            className="bzw-launcher"
            aria-label="باز کردن گفتگو"
            aria-expanded={false}
            onClick={() => setOpen(true)}
          >
            <span className="bzw-ping" aria-hidden />
            <span className="bzw-ping is-delay" aria-hidden />
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12c0 4.4-4.3 8-9.5 8-1.1 0-2.1-.1-3.1-.4L3 21l1.6-4.1C3.6 15.7 3 13.9 3 12c0-4.4 4.3-8 9.5-8S21 7.6 21 12z" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
