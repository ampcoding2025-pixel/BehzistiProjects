"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useLocale } from "@/lib/i18n/locale";
import { localeFromProfileLanguage } from "@/lib/i18n/messages";

const TONE_KEYS = ["friendly", "professional", "casual", "empathetic"] as const;
const LENGTH_KEYS = ["short", "medium", "long"] as const;
const LANGUAGE_KEYS = ["allLanguages", "english", "persian"] as const;

const DEFAULT_AGENT_MESSAGE =
  "Good morning, Amp! Welcome to our chat—you're in a preview chat, and it's great to have you here for the first time. How can I assist you today?";

type ChatMessage = {
  id: string;
  role: "agent" | "visitor";
  text: string;
};

type Props = {
  initialName?: string;
  initialCustomVoice?: string;
};

export function Profile({
  initialName,
  initialCustomVoice = "You are a calm, welcoming support specialist who...",
}: Props) {
  const { locale, setLocale, t } = useLocale();
  const toneMenuId = useId();
  const lengthMenuId = useId();
  const languageMenuId = useId();

  const [name, setName] = useState(initialName ?? t.nav.aiAgent);
  const [acceptingChats, setAcceptingChats] = useState(true);
  const [languageKey, setLanguageKey] = useState<(typeof LANGUAGE_KEYS)[number]>(
    locale === "fa" ? "persian" : "english",
  );
  const [toneKey, setToneKey] = useState<(typeof TONE_KEYS)[number]>("friendly");
  const [answerLengthKey, setAnswerLengthKey] =
    useState<(typeof LENGTH_KEYS)[number]>("short");
  const [customVoice] = useState(initialCustomVoice);
  const [openMenu, setOpenMenu] = useState<"language" | "tone" | "length" | null>(null);

  const languageOptions = useMemo(
    () =>
      LANGUAGE_KEYS.map((key) => ({
        key,
        label: t.profile[key],
      })),
    [t],
  );
  const toneOptions = useMemo(
    () => TONE_KEYS.map((key) => ({ key, label: t.profile[key] })),
    [t],
  );
  const lengthOptions = useMemo(
    () => LENGTH_KEYS.map((key) => ({ key, label: t.profile[key] })),
    [t],
  );

  useEffect(() => {
    setLanguageKey(locale === "fa" ? "persian" : "english");
    if (!initialName) setName(t.nav.aiAgent);
  }, [locale, t.nav.aiAgent, initialName]);

  function applyUiLanguage(key: (typeof LANGUAGE_KEYS)[number]) {
    setLanguageKey(key);
    const next = localeFromProfileLanguage(
      key === "persian" ? "Persian" : key === "english" ? "English" : "",
    );
    if (next) setLocale(next);
    // "All languages" keeps current UI locale but is stored as agent preference.
  }
  const [previewKey, setPreviewKey] = useState(0);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "a1", role: "agent", text: DEFAULT_AGENT_MESSAGE },
    { id: "v1", role: "visitor", text: "بلبلب" },
  ]);

  const sendDraft = () => {
    const text = draft.trim();
    if (!text) return;
    setMessages((prev) => [...prev, { id: `v-${Date.now()}`, role: "visitor", text }]);
    setDraft("");
  };

  const resetChat = () => {
    setPreviewKey((k) => k + 1);
    setDraft("");
    setMessages([
      { id: "a1", role: "agent", text: DEFAULT_AGENT_MESSAGE },
      { id: "v1", role: "visitor", text: "بلبلب" },
    ]);
  };

  return (
    <div className="pf-grid">
      <div className="pf-settings">
      <div className="pf-settings__wrapper pf-settings__wrapper--contextual">
        <div className="pf-profile">
          {/* Name + status */}
          <div className="pf-profile__row pf-profile__row--lg">
            <div
              className="pf-agent"
              aria-label={t.nav.aiAgent}
              role="button"
              tabIndex={0}
            >
              <div className="pf-agent__avatar-wrapper">
                <div className="pf-avatar-menu">
                  <div
                    className="pf-avatar-menu__trigger"
                    role="button"
                    tabIndex={0}
                    aria-expanded="false"
                    aria-haspopup="menu"
                    data-testid="ai-agent-avatar"
                  >
                    <div
                      className="pf-avatar pf-avatar--md"
                      style={{ ["--avatar-bg-color" as string]: "var(--surface-secondary-default)" }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        alt={t.nav.aiAgent}
                        className="pf-avatar__image"
                        src="/behzisti-logo.png"
                      />
                    </div>
                    <div className="pf-avatar-menu__edit-overlay">
                      <div className="pf-avatar-menu__edit-button">
                        <svg viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
                          <path
                            d="M13.5 6.5L17.5 10.5M4 20.0001H8L18.5 9.50006C19.0304 8.96963 19.3284 8.2502 19.3284 7.50006C19.3284 6.74991 19.0304 6.03049 18.5 5.50006C17.9696 4.96963 17.2501 4.67163 16.5 4.67163C15.7499 4.67163 15.0304 4.96963 14.5 5.50006L4 16.0001V20.0001Z"
                            stroke="currentcolor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pf-agent__name-wrapper">
                <span className="pf-field-label">{t.profile.name}</span>
                <div className="pf-agent__name-value">
                  <span className="pf-field-value">{name}</span>
                </div>
              </div>

              <button
                type="button"
                className="pf-btn pf-btn--plain pf-btn--icon"
                aria-label={t.profile.editName}
                tabIndex={-1}
              >
                <svg viewBox="0 0 24 24" fill="none" width="20" height="20" aria-hidden="true">
                  <path
                    d="M13.5 6.5L17.5 10.5M4 20.0001H8L18.5 9.50006C19.0304 8.96963 19.3284 8.2502 19.3284 7.50006C19.3284 6.74991 19.0304 6.03049 18.5 5.50006C17.9696 4.96963 17.2501 4.67163 16.5 4.67163C15.7499 4.67163 15.0304 4.96963 14.5 5.50006L4 16.0001V20.0001Z"
                    stroke="currentcolor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>

            <label className="pf-status">
              <span className="pf-status__content">
                <span className="pf-field-label">{t.profile.status}</span>
                <span className="pf-field-value">
                  {acceptingChats ? t.profile.acceptingChats : t.profile.notAcceptingChats}
                </span>
              </span>
              <span className="pf-switch" data-testid="accept-chats-switch-trigger">
                <span className="pf-switch__inner pf-switch__inner--compact">
                  <input
                    aria-label={t.profile.acceptChats}
                    className="pf-switch__input"
                    type="checkbox"
                    checked={acceptingChats}
                    name="switch"
                    onChange={(e) => setAcceptingChats(e.target.checked)}
                  />
                  <span className="pf-switch__container">
                    <span
                      className={`pf-switch__track${acceptingChats ? " pf-switch__track--on" : ""}`}
                    />
                    <span
                      className={`pf-switch__slider pf-switch__slider--compact${
                        acceptingChats ? " pf-switch__slider--on" : ""
                      }`}
                    />
                  </span>
                </span>
              </span>
            </label>
          </div>

          {/* Language */}
          <div className="pf-picker-wrap">
            <div
              className="pf-language"
              role="button"
              tabIndex={0}
              aria-expanded={openMenu === "language"}
              aria-haspopup="menu"
              id={languageMenuId}
              onClick={() => setOpenMenu(openMenu === "language" ? null : "language")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setOpenMenu(openMenu === "language" ? null : "language");
                }
              }}
            >
              <div className="pf-language__container">
                <span className="pf-field-label">{t.profile.language}</span>
                <span className="pf-field-value pf-language__selected">
                  {t.profile[languageKey]}
                </span>
              </div>
              <ChevronDown />
            </div>
            {openMenu === "language" ? (
              <div className="pf-menu" role="menu">
                {languageOptions.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    role="menuitem"
                    className={`pf-menu__item${item.key === languageKey ? " is-active" : ""}`}
                    onClick={() => {
                      applyUiLanguage(item.key);
                      setOpenMenu(null);
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
            <p className="pf-language-hint">{t.profile.uiLanguageHint}</p>
          </div>

          {/* Tone + Answer length */}
          <div className="pf-profile__row">
            <div className="pf-picker-wrap pf-picker-wrap--half">
              <div
                className="pf-picker"
                role="button"
                tabIndex={0}
                aria-expanded={openMenu === "tone"}
                aria-haspopup="menu"
                id={toneMenuId}
                onClick={() => setOpenMenu(openMenu === "tone" ? null : "tone")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setOpenMenu(openMenu === "tone" ? null : "tone");
                  }
                }}
              >
                <div className="pf-picker__container">
                  <span className="pf-field-label">{t.profile.toneOfVoice}</span>
                  <div className="pf-picker__selected">
                    <ToneIcon />
                    <span className="pf-field-value">{t.profile[toneKey]}</span>
                  </div>
                </div>
                <ChevronDown />
              </div>
              {openMenu === "tone" ? (
                <div className="pf-menu" role="menu">
                  {toneOptions.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      role="menuitem"
                      className={`pf-menu__item${item.key === toneKey ? " is-active" : ""}`}
                      onClick={() => {
                        setToneKey(item.key);
                        setOpenMenu(null);
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="pf-picker-wrap pf-picker-wrap--half">
              <div
                className="pf-picker"
                role="button"
                tabIndex={0}
                aria-expanded={openMenu === "length"}
                aria-haspopup="menu"
                id={lengthMenuId}
                onClick={() => setOpenMenu(openMenu === "length" ? null : "length")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setOpenMenu(openMenu === "length" ? null : "length");
                  }
                }}
              >
                <div className="pf-picker__container">
                  <span className="pf-field-label">{t.profile.answerLength}</span>
                  <div className="pf-picker__selected">
                    <LengthIcon />
                    <span className="pf-field-value">{t.profile[answerLengthKey]}</span>
                  </div>
                </div>
                <ChevronDown />
              </div>
              {openMenu === "length" ? (
                <div className="pf-menu" role="menu">
                  {lengthOptions.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      role="menuitem"
                      className={`pf-menu__item${item.key === answerLengthKey ? " is-active" : ""}`}
                      onClick={() => {
                        setAnswerLengthKey(item.key);
                        setOpenMenu(null);
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {/* Custom voice */}
          <div
            aria-label={t.profile.customVoice}
            className="pf-instructions"
            role="button"
            tabIndex={0}
          >
            <div className="pf-instructions__wrapper" style={{ height: 73 }}>
              <div className="pf-instructions__content-wrap">
                <div className="pf-state-preview" role="button">
                  <div className="pf-state-preview__content">
                    <span className="pf-field-label">{t.profile.customVoice}</span>
                    <span className="pf-field-value pf-state-preview__text">{customVoice}</span>
                  </div>
                  <div className="pf-state-preview__button">
                    <button
                      type="button"
                      className="pf-btn pf-btn--plain pf-btn--icon"
                      aria-label="Edit instructions"
                      tabIndex={-1}
                    >
                      <svg viewBox="0 0 24 24" fill="none" width="20" height="20" aria-hidden="true">
                        <path
                          d="M13.5 6.5L17.5 10.5M4 20.0001H8L18.5 9.50006C19.0304 8.96963 19.3284 8.2502 19.3284 7.50006C19.3284 6.74991 19.0304 6.03049 18.5 5.50006C17.9696 4.96963 17.2501 4.67163 16.5 4.67163C15.7499 4.67163 15.0304 4.96963 14.5 5.50006L4 16.0001V20.0001Z"
                          stroke="currentcolor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>

      <div className="pf-preview">
        <div className="pf-preview__wrapper pf-preview__wrapper--contextual">
          <div className="pf-preview__chat">
            <div className="pf-preview__widget">
              <div className="pf-preview__widget-frame" key={previewKey}>
                <div
                  data-testid="maximized"
                  id="chat-widget-maximized"
                  dir="ltr"
                  className="lg-widget"
                  role="presentation"
                >
                  <div role="main" className="lg-widget__main">
                    <div className="lg-widget__top">
                      <div
                        aria-labelledby="pf-dynamic-island-aria-label"
                        data-testid="agent-bar"
                        id="agent-bar"
                        role="button"
                        tabIndex={0}
                        className="lg-widget__agent-bar"
                      >
                        <div className="lg-widget__agent-bar-inner">
                          <div data-testid="agent-avatar" className="lg-widget__avatar-wrap">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              alt="Current agent avatar"
                              draggable={false}
                              className="lg-widget__avatar"
                              src="/behzisti-logo.png"
                            />
                          </div>
                          <div className="lg-widget__agent-meta">
                            <h1>{name}</h1>
                            <span className="lg-widget__agent-sub">AI Assistant</span>
                          </div>
                        </div>
                        <span
                          id="pf-dynamic-island-aria-label"
                          aria-live="polite"
                          className="lg-widget__sr-only"
                        >
                          {name}, Press to expand details
                        </span>
                      </div>
                    </div>

                    <div data-testid="chat-view" className="lg-widget__chat-view">
                      <div
                        id="message-list"
                        data-testid="message-list"
                        className="lg-widget__message-list"
                      >
                        <div role="grid" aria-live="polite" aria-relevant="additions" tabIndex={-1}>
                          {messages.map((m) =>
                            m.role === "agent" ? (
                              <div
                                key={m.id}
                                data-testid="message-group-null"
                                className="lg-widget__message-group"
                              >
                                <div className="lg-widget__msg-avatar-col">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    alt="Current agent avatar"
                                    draggable={false}
                                    className="lg-widget__msg-avatar"
                                    src="/behzisti-logo.png"
                                  />
                                </div>
                                <div className="lg-widget__msg-col">
                                  <div role="row">
                                    <div data-testid="message-item" className="lg-widget__message-item">
                                      <div role="gridcell" className="lg-widget__bubble" tabIndex={0}>
                                        {m.text}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div
                                key={m.id}
                                data-testid="message-group-null"
                                className="lg-widget__message-group lg-widget__message-group--visitor"
                              >
                                <div className="lg-widget__msg-col lg-widget__msg-col--visitor">
                                  <div role="row">
                                    <div data-testid="message-item" className="lg-widget__message-item">
                                      <div
                                        role="gridcell"
                                        className="lg-widget__bubble lg-widget__bubble--visitor"
                                        tabIndex={0}
                                      >
                                        <span className="Linkify">{m.text}</span>
                                      </div>
                                      <div className="lg-widget__read">Read</div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </div>

                      <div className="lg-widget__composer-wrap">
                        <div className="lg-widget__composer">
                          <textarea
                            data-testid="message-input"
                            aria-label="Write a message…"
                            data-enable-grammarly="false"
                            enterKeyHint="send"
                            dir="ltr"
                            id="chat-widget-text-input"
                            className="lg-widget__input"
                            placeholder="Write a message…"
                            rows={1}
                            style={{ height: "45px" }}
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                sendDraft();
                              }
                            }}
                          />
                          <div className="lg-widget__send-wrap">
                            <button
                              data-testid="send-message"
                              aria-label="Send message"
                              className={`lg-widget__send${draft.trim() ? " lg-widget__send--ready" : ""}`}
                              disabled={!draft.trim()}
                              type="button"
                              onClick={sendDraft}
                            >
                              <svg viewBox="0 0 32 32" aria-hidden="true" width="20" height="20">
                                <path
                                  d="M16.7071068,8.29289322 L22.7071068,14.2928932 C23.0976311,14.6834175 23.0976311,15.3165825 22.7071068,15.7071068 C22.3466228,16.0675907 21.7793918,16.0953203 21.3871006,15.7902954 L21.2928932,15.7071068 L17,11.414 L17,24 C17,24.5128358 16.6139598,24.9355072 16.1166211,24.9932723 L16,25 C15.4871642,25 15.0644928,24.6139598 15.0067277,24.1166211 L15,24 L15,11.414 L10.7071068,15.7071068 C10.3466228,16.0675907 9.77939176,16.0953203 9.38710056,15.7902954 L9.29289322,15.7071068 C8.93240926,15.3466228 8.90467972,14.7793918 9.20970461,14.3871006 L9.29289322,14.2928932 L15.2928932,8.29289322 C15.6533772,7.93240926 16.2206082,7.90467972 16.6128994,8.20970461 L16.7071068,8.29289322 Z"
                                  fill="currentColor"
                                />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="pf-btn pf-btn--float pf-preview__reset"
                aria-label="Reset chat"
                onClick={resetChat}
              >
                <svg viewBox="0 0 24 24" fill="none" width="20" height="20" aria-hidden="true">
                  <path
                    d="M19.9331 13.0409C19.7442 14.4809 19.167 15.8423 18.2632 16.9791C17.3595 18.1159 16.1633 18.9853 14.803 19.4939C13.4427 20.0026 11.9696 20.1314 10.5417 19.8665C9.1138 19.6016 7.78492 18.953 6.69761 17.9902C5.6103 17.0275 4.80557 15.7869 4.36973 14.4016C3.93389 13.0162 3.88338 11.5384 4.22362 10.1265C4.56385 8.71464 5.282 7.42202 6.30104 6.38728C7.32007 5.35254 8.60156 4.61471 10.0081 4.25292C13.9071 3.25292 17.9431 5.25992 19.4331 8.99992M20 4V9H15"
                    stroke="currentcolor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChevronDown() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      width="20"
      height="20"
      color="var(--content-basic-primary)"
      aria-hidden="true"
    >
      <path
        d="M6 9L12 15L18 9"
        stroke="currentcolor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ToneIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      width="16"
      height="16"
      color="var(--content-basic-secondary)"
      aria-hidden="true"
    >
      <path
        d="M16.2501 10.4771L10.0001 16.6671L3.75009 10.4771C3.33784 10.0759 3.01312 9.59374 2.79638 9.06092C2.57963 8.52811 2.47556 7.95618 2.4907 7.38117C2.50585 6.80615 2.63989 6.2405 2.88439 5.71984C3.12888 5.19917 3.47853 4.73477 3.91133 4.35587C4.34412 3.97698 4.85068 3.6918 5.3991 3.51829C5.94752 3.34479 6.52593 3.28671 7.09789 3.34773C7.66986 3.40874 8.223 3.58752 8.72248 3.87281C9.22196 4.1581 9.65696 4.54372 10.0001 5.00539C10.3447 4.54708 10.7802 4.16483 11.2793 3.88256C11.7785 3.6003 12.3305 3.4241 12.9009 3.36499C13.4712 3.30588 14.0477 3.36514 14.5941 3.53905C15.1405 3.71296 15.6451 3.99779 16.0764 4.37569C16.5077 4.7536 16.8563 5.21646 17.1004 5.7353C17.3446 6.25414 17.479 6.81779 17.4953 7.39098C17.5117 7.96417 17.4095 8.53455 17.1952 9.06643C16.9809 9.59831 16.6592 10.0802 16.2501 10.4821M10.0001 5.00039L7.25592 7.74456C7.09969 7.90083 7.01193 8.11275 7.01193 8.33372C7.01193 8.55469 7.09969 8.76662 7.25592 8.92289L7.70842 9.37539C8.28342 9.95039 9.21675 9.95039 9.79175 9.37539L10.6251 8.54206C11.1224 8.04478 11.7968 7.76541 12.5001 7.76541C13.2033 7.76541 13.8778 8.04478 14.3751 8.54206L16.2501 10.4171M10.4168 12.9171L12.0834 14.5837M12.5001 10.8337L14.1668 12.5004"
        stroke="currentcolor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LengthIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      width="16"
      height="16"
      color="var(--content-basic-secondary)"
      aria-hidden="true"
    >
      <path
        d="M4 15H8.5M4 9H20"
        stroke="currentcolor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
