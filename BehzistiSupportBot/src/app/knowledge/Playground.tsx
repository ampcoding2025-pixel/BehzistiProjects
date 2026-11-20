"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useLocale } from "@/lib/i18n/locale";

type PlayMsg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ id: string; title: string; source: string; score: number }>;
  provider?: string | null;
  confidence?: number;
};

type SuggestedQ = {
  id: string;
  title: string;
  question: string;
};

type ScenarioTab = "suggested" | "gaps";

const AVATAR = "/behzisti-logo.svg";

export function Playground() {
  const { t, locale } = useLocale();
  const [tab, setTab] = useState<ScenarioTab>("suggested");
  const [suggestions, setSuggestions] = useState<SuggestedQ[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [messages, setMessages] = useState<PlayMsg[]>([
    { id: "welcome", role: "assistant", content: "" },
  ]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAssistant, setLastAssistant] = useState<PlayMsg | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    void (async () => {
      setSuggestionsLoading(true);
      try {
        const [kn, ol] = await Promise.all([
          fetch("/api/knowledge?appId=behzisti-portal&source=faq&limit=8").then((r) => r.json()),
          fetch("/api/ollama").then((r) => r.json()),
        ]);
        const faqs = (kn.faqs ?? []) as SuggestedQ[];
        setSuggestions(
          faqs.map((f) => ({
            id: f.id,
            title: f.title,
            question: f.question || f.title,
          })),
        );
        setNeedsSetup(!(ol.ready && (kn.count ?? 0) > 0));
      } catch {
        setSuggestions([]);
        setNeedsSetup(true);
      } finally {
        setSuggestionsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].id === "welcome") {
        return [{ id: "welcome", role: "assistant", content: t.playground.welcome }];
      }
      return prev;
    });
  }, [locale, t.playground.welcome]);

  function resetChat() {
    setMessages([{ id: "welcome", role: "assistant", content: t.playground.welcome }]);
    setSessionId(null);
    setLastAssistant(null);
    setError(null);
    setInput("");
    inputRef.current?.focus();
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    setInput("");
    setError(null);
    setBusy(true);
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", content: trimmed }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-App-Id": "behzisti-portal",
        },
        body: JSON.stringify({
          message: trimmed,
          sessionId,
          appId: "behzisti-portal",
          userLabel: "Playground",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Chat request failed");

      setSessionId(data.sessionId ?? null);
      const assistant: PlayMsg = {
        id: data.message?.id || `a-${Date.now()}`,
        role: "assistant",
        content: data.message?.content || "",
        sources: data.message?.sources,
        provider: data.provider ?? null,
        confidence: data.message?.confidence,
      };
      setMessages((prev) => [...prev, assistant]);
      setLastAssistant(assistant);
      if (!detailsOpen) setDetailsOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void sendMessage(input);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  }

  return (
    <div className="pg">
      <header className="pg-content-header">
        <h5 className="pg-content-header__title">{t.playground.title}</h5>
        <div className="pg-content-header__right">
          <div
            className={`pg-tag pg-tag--lg${needsSetup ? " pg-tag--warning" : " pg-tag--positive"}`}
          >
            <span className="pg-tag__icon" aria-hidden="true">
              {needsSetup ? <AlertIcon /> : <CheckIcon />}
            </span>
            <span className="pg-tag__label">
              {needsSetup ? t.playground.needsSetup : t.playground.ready}
            </span>
          </div>
        </div>
      </header>

      <div className="pg-layout">
        {/* Left — testing scenarios */}
        <section className="pg-scenarios" aria-label={t.playground.chooseScenario}>
          <div className="pg-scenarios__heading">
            <h2 className="pg-scenarios__title">{t.playground.chooseScenario}</h2>
            <p className="pg-scenarios__desc">{t.playground.chooseScenarioDesc}</p>
          </div>

          <div className="pg-scenarios__tabs">
            <fieldset className="pg-segmented">
              <button
                type="button"
                className={`pg-segmented__btn${tab === "suggested" ? " is-active" : ""}`}
                aria-pressed={tab === "suggested"}
                onClick={() => setTab("suggested")}
              >
                {t.playground.suggested}
              </button>
              <button
                type="button"
                className={`pg-segmented__btn${tab === "gaps" ? " is-active" : ""}`}
                aria-pressed={tab === "gaps"}
                onClick={() => setTab("gaps")}
              >
                {t.playground.knowledgeGaps}
              </button>
            </fieldset>
          </div>

          <div className="pg-scenarios__content">
            {tab === "suggested" ? (
              suggestionsLoading ? (
                <p className="pg-muted">{t.playground.loadingSuggestions}</p>
              ) : suggestions.length === 0 ? (
                <div className="pg-empty">
                  <div className="pg-empty__icon">
                    <ChatBubbleIcon />
                  </div>
                  <h4 className="pg-empty__title">{t.playground.noSuggestedTitle}</h4>
                  <span className="pg-empty__desc">{t.playground.noSuggestedDesc}</span>
                </div>
              ) : (
                <ul className="pg-suggest-list">
                  {suggestions.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        className="pg-suggest-card"
                        disabled={busy}
                        onClick={() => void sendMessage(s.question)}
                      >
                        <span className="pg-suggest-card__title">{s.title}</span>
                        <span className="pg-suggest-card__q">{s.question}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <div className="pg-empty">
                <div className="pg-empty__icon">
                  <AlertIcon size={40} />
                </div>
                <h4 className="pg-empty__title">{t.playground.noGapsTitle}</h4>
                <span className="pg-empty__desc">{t.playground.noGapsDesc}</span>
              </div>
            )}
          </div>
        </section>

        {/* Center — chat preview */}
        <div className="pg-chat">
          <section className="pg-chat__preview" aria-label={t.playground.title}>
            <div className="pg-widget">
              <div className="pg-widget__bar" data-testid="agent-bar">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="pg-widget__avatar" src={AVATAR} alt="" draggable={false} />
                <div className="pg-widget__titles">
                  <h1 className="pg-widget__name">{t.playground.agentName}</h1>
                </div>
              </div>

              <div className="pg-widget__messages" id="message-list" ref={listRef} data-testid="message-list">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`pg-msg${m.role === "user" ? " pg-msg--user" : " pg-msg--agent"}`}
                    data-testid="message-item"
                  >
                    {m.role === "assistant" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="pg-msg__avatar" src={AVATAR} alt="" draggable={false} />
                    ) : null}
                    <div className="pg-msg__bubble" dir="auto">
                      {m.content}
                    </div>
                  </div>
                ))}
                {busy ? <div className="pg-typing">{t.playground.typing}</div> : null}
              </div>

              {error ? <p className="pg-error">{error}</p> : null}

              <form className="pg-composer" onSubmit={onSubmit}>
                <textarea
                  ref={inputRef}
                  data-testid="message-input"
                  aria-label={t.playground.writeMessage}
                  className="pg-composer__input"
                  placeholder={t.playground.writeMessage}
                  maxLength={2000}
                  rows={1}
                  value={input}
                  disabled={busy}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  dir="auto"
                />
                <button
                  type="submit"
                  data-testid="send-message"
                  aria-label={t.playground.send}
                  className="pg-composer__send"
                  disabled={busy || !input.trim()}
                >
                  <SendIcon />
                </button>
              </form>
            </div>

            <button
              type="button"
              className="pg-reset"
              aria-label={t.playground.resetChat}
              onClick={resetChat}
            >
              <ResetIcon />
            </button>
          </section>
        </div>

        {/* Right — details */}
        {detailsOpen ? (
          <aside className="pg-details" aria-label={t.playground.details} role="region">
            <div className="pg-details__panel">
              <header className="pg-content-header pg-details__header">
                <h5 className="pg-content-header__title">{t.playground.details}</h5>
                <button
                  type="button"
                  className="pg-icon-btn"
                  aria-label={t.playground.collapseDetails}
                  onClick={() => setDetailsOpen(false)}
                >
                  <CollapseIcon />
                </button>
              </header>

              <section className="pg-details__body" aria-label={t.playground.details}>
                {!lastAssistant ? (
                  <div className="pg-empty">
                    <div className="pg-empty__icon">
                      <InfoIcon />
                    </div>
                    <h4 className="pg-empty__title">{t.playground.noResponseTitle}</h4>
                    <span className="pg-empty__desc">{t.playground.noResponseDesc}</span>
                  </div>
                ) : (
                  <div className="pg-answer-details">
                    <div className="pg-answer-details__row">
                      <span className="pg-answer-details__label">{t.playground.provider}</span>
                      <span className="pg-answer-details__value">
                        {lastAssistant.provider || "lexical"}
                      </span>
                    </div>
                    {typeof lastAssistant.confidence === "number" ? (
                      <div className="pg-answer-details__row">
                        <span className="pg-answer-details__label">{t.playground.confidence}</span>
                        <span className="pg-answer-details__value">
                          {(lastAssistant.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    ) : null}
                    <div className="pg-answer-details__block">
                      <span className="pg-answer-details__label">{t.playground.sourcesUsed}</span>
                      {lastAssistant.sources?.length ? (
                        <ul className="pg-answer-details__sources">
                          {lastAssistant.sources.map((s) => (
                            <li key={s.id}>
                              <strong>[{s.source}]</strong> {s.title}
                              <em> · {s.score.toFixed(2)}</em>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="pg-muted">{t.playground.noSourcesMatched}</p>
                      )}
                    </div>
                  </div>
                )}
              </section>
            </div>
          </aside>
        ) : (
          <button
            type="button"
            className="pg-details-open"
            onClick={() => setDetailsOpen(true)}
          >
            {t.playground.details}
          </button>
        )}
      </div>
    </div>
  );
}

function AlertIcon({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} aria-hidden="true">
      <path
        d="M12 8V12M12 16H12.01M3 12C3 13.1819 3.23279 14.3522 3.68508 15.4442C4.13738 16.5361 4.80031 17.5282 5.63604 18.364C6.47177 19.1997 7.46392 19.8626 8.55585 20.3149C9.64778 20.7672 10.8181 21 12 21C13.1819 21 14.3522 20.7672 15.4442 20.3149C16.5361 19.8626 17.5282 19.1997 18.364 18.364C19.1997 17.5282 19.8626 16.5361 20.3149 15.4442C20.7672 14.3522 21 13.1819 21 12C21 10.8181 20.7672 9.64778 20.3149 8.55585C19.8626 7.46392 19.1997 6.47177 18.364 5.63604C17.5282 4.80031 16.5361 4.13738 15.4442 3.68508C14.3522 3.23279 13.1819 3 12 3C10.8181 3 9.64778 3.23279 8.55585 3.68508C7.46392 4.13738 6.47177 4.80031 5.63604 5.63604C4.80031 6.47177 4.13738 7.46392 3.68508 8.55585C3.23279 9.64778 3 10.8181 3 12Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20" aria-hidden="true">
      <path
        d="M5 12L10 17L20 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChatBubbleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="40" height="40" aria-hidden="true">
      <path
        d="M3 20L4.3 16.1C3.17644 14.4383 2.76999 12.4704 3.15622 10.5623C3.54244 8.65419 4.69506 6.93567 6.39977 5.72628C8.10447 4.51688 10.2453 3.8989 12.4241 3.98724C14.6029 4.07559 16.6715 4.86424 18.2453 6.20656C19.819 7.54889 20.7909 9.35354 20.9801 11.285C21.1693 13.2164 20.563 15.1432 19.2739 16.7071C17.9848 18.271 16.1007 19.3656 13.9718 19.7874C11.8429 20.2091 9.6142 19.9293 7.7 19L3 20Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="40" height="40" aria-hidden="true">
      <path
        d="M12 8H12.01M11 12H12V16H13M3 12C3 13.1819 3.23279 14.3522 3.68508 15.4442C4.13738 16.5361 4.80031 17.5282 5.63604 18.364C6.47177 19.1997 7.46392 19.8626 8.55585 20.3149C9.64778 20.7672 10.8181 21 12 21C13.1819 21 14.3522 20.7672 15.4442 20.3149C16.5361 19.8626 17.5282 19.1997 18.364 18.364C19.1997 17.5282 19.8626 16.5361 20.3149 15.4442C20.7672 14.3522 21 13.1819 21 12C21 10.8181 20.7672 9.64778 20.3149 8.55585C19.8626 7.46392 19.1997 6.47177 18.364 5.63604C17.5282 4.80031 16.5361 4.13738 15.4442 3.68508C14.3522 3.23279 13.1819 3 12 3C10.8181 3 9.64778 3.23279 8.55585 3.68508C7.46392 4.13738 6.47177 4.80031 5.63604 5.63604C4.80031 6.47177 4.13738 7.46392 3.68508 8.55585C3.23279 9.64778 3 10.8181 3 12Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 32 32" width="20" height="20" aria-hidden="true">
      <path
        d="M16.7071068,8.29289322 L22.7071068,14.2928932 C23.0976311,14.6834175 23.0976311,15.3165825 22.7071068,15.7071068 C22.3466228,16.0675907 21.7793918,16.0953203 21.3871006,15.7902954 L21.2928932,15.7071068 L17,11.414 L17,24 C17,24.5128358 16.6139598,24.9355072 16.1166211,24.9932723 L16,25 C15.4871642,25 15.0644928,24.6139598 15.0067277,24.1166211 L15,24 L15,11.414 L10.7071068,15.7071068 C10.3466228,16.0675907 9.77939176,16.0953203 9.38710056,15.7902954 L9.29289322,15.7071068 C8.93240926,15.3466228 8.90467972,14.7793918 9.20970461,14.3871006 L9.29289322,14.2928932 L15.2928932,8.29289322 C15.6533772,7.93240926 16.2206082,7.90467972 16.6128994,8.20970461 L16.7071068,8.29289322 Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20" aria-hidden="true">
      <path
        d="M19.9331 13.0409C19.7442 14.4809 19.167 15.8423 18.2632 16.9791C17.3595 18.1159 16.1633 18.9853 14.803 19.4939C13.4427 20.0026 11.9696 20.1314 10.5417 19.8665C9.1138 19.6016 7.78492 18.953 6.69761 17.9902C5.6103 17.0275 4.80557 15.7869 4.36973 14.4016C3.93389 13.0162 3.88338 11.5384 4.22362 10.1265C4.56385 8.71464 5.282 7.42202 6.30104 6.38728C7.32007 5.35254 8.60156 4.61471 10.0081 4.25292C13.9071 3.25292 17.9431 5.25992 19.4331 8.99992M20 4V9H15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CollapseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20" aria-hidden="true">
      <path
        d="M15 4V20M4 6C4 5.46957 4.21071 4.96086 4.58579 4.58579C4.96086 4.21071 5.46957 4 6 4H18C18.5304 4 19.0391 4.21071 19.4142 4.58579C19.7893 4.96086 20 5.46957 20 6V18C20 18.5304 19.7893 19.0391 19.4142 19.4142C19.0391 19.7893 18.5304 20 18 20H6C5.46957 20 4.96086 19.7893 4.58579 19.4142C4.21071 19.0391 4 18.5304 4 18V6Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
