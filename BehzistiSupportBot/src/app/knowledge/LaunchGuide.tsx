"use client";

import { useState } from "react";

type StepId = "create" | "activate" | "train" | "channels";

const SKILLS = [
  { label: "Collect customers details", icon: "user" as const },
  { label: "Transfer chats to humans", icon: "transfer" as const },
  { label: "Handle tickets", icon: "ticket" as const },
  { label: "Send personalized greeting", icon: "wave" as const },
];

const QUICK_REPLIES = [
  "What are your company’s products or services?",
  "How can I contact customer support?",
  "Where can I find more information about your product?",
];

type Props = {
  onAddWebsite?: () => void;
  onAddFiles?: () => void;
  onConnectChannels?: () => void;
};

export function LaunchGuide({ onAddWebsite, onAddFiles, onConnectChannels }: Props) {
  const [openStep, setOpenStep] = useState<StepId | null>("train");
  const [previewKey, setPreviewKey] = useState(0);

  function toggle(id: StepId) {
    setOpenStep((cur) => (cur === id ? null : id));
  }

  return (
    <div className="lg-content">
      <h1 className="lg-heading">Launch your AI Agent now</h1>

      <div className="lg-layout">
        <div className="lg-guide">
          <div className="lg-steps">
            {/* Create AI agent — complete */}
            <section
              className="lg-step"
              data-has-body="true"
              data-open={openStep === "create" ? "true" : undefined}
            >
              <div className="lg-step__header">
                <button
                  type="button"
                  className="lg-step__trigger"
                  aria-expanded={openStep === "create"}
                  aria-label="Create AI agent complete"
                  onClick={() => toggle("create")}
                />
                <span className="lg-step__status-marker" role="img" aria-label="Create AI agent complete">
                  <CheckIcon />
                </span>
                <span className="lg-step__label-copy">
                  <span className="lg-step__title lg-step__title--bold">Create AI agent</span>
                </span>
                <span className="lg-step__badge">
                  <span className="lg-pill lg-pill--lg lg-pill--border">
                    <span className="lg-pill__wrap">
                      <span className="lg-pill__icon">
                        <PlayCircleIcon />
                      </span>
                      <span className="lg-pill__text">4 skills</span>
                    </span>
                  </span>
                </span>
                <span className="lg-step__chevron">
                  <ChevronIcon up={openStep === "create"} />
                </span>
              </div>
              <div
                className="lg-step__content"
                aria-hidden={openStep !== "create"}
                inert={openStep !== "create" ? true : undefined}
                data-open={openStep === "create" ? "true" : undefined}
              >
                <div className="lg-step__content-inner">
                  <div className="lg-step__body">
                    <div className="lg-skills">
                      {SKILLS.map((s) => (
                        <div key={s.label} className="lg-pill lg-pill--lg lg-skill">
                          <span className="lg-pill__wrap">
                            <span className="lg-pill__icon">
                              <SkillIcon kind={s.icon} />
                            </span>
                            <span className="lg-pill__text">{s.label}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <footer>
                    <div className="lg-step__footer lg-step__footer--create">
                      <button type="button" className="lg-btn lg-btn--float lg-btn--md lg-btn--right-icon">
                        <span className="lg-btn__icon lg-btn__icon--right">
                          <PlusIcon />
                        </span>
                        <span className="lg-btn__content">Create skill</span>
                      </button>
                      <button type="button" className="lg-btn lg-btn--plain lg-btn--md lg-btn--right-icon">
                        <span className="lg-btn__icon lg-btn__icon--right">
                          <ArrowRightIcon />
                        </span>
                        <span className="lg-btn__content">See all skills</span>
                      </button>
                    </div>
                  </footer>
                </div>
              </div>
            </section>

            {/* Activate — complete */}
            <section
              className="lg-step"
              data-open={openStep === "activate" ? "true" : undefined}
            >
              <div className="lg-step__header">
                <button
                  type="button"
                  className="lg-step__trigger"
                  aria-expanded={openStep === "activate"}
                  aria-label="Activate your AI Agent complete"
                  onClick={() => toggle("activate")}
                />
                <span
                  className="lg-step__status-marker"
                  role="img"
                  aria-label="Activate your AI Agent complete"
                >
                  <CheckIcon />
                </span>
                <span className="lg-step__label-copy">
                  <span className="lg-step__title lg-step__title--bold">Activate your AI Agent</span>
                </span>
                <span className="lg-step__chevron">
                  <ChevronIcon up={openStep === "activate"} />
                </span>
              </div>
              <div
                className="lg-step__content"
                aria-hidden={openStep !== "activate"}
                inert={openStep !== "activate" ? true : undefined}
                data-open={openStep === "activate" ? "true" : undefined}
              >
                <div className="lg-step__content-inner">
                  <footer>
                    <div className="lg-step__footer lg-step__footer--activate">
                      <div className="lg-activate-status">
                        <span className="lg-status-badge lg-status-badge--accept" role="status" />
                        <span>Answering chats</span>
                      </div>
                      <button type="button" className="lg-btn lg-btn--plain lg-btn--md lg-btn--right-icon">
                        <span className="lg-btn__icon lg-btn__icon--right">
                          <ArrowRightIcon />
                        </span>
                        <span className="lg-btn__content">View profile</span>
                      </button>
                    </div>
                  </footer>
                </div>
              </div>
            </section>

            {/* Train — open / incomplete */}
            <section
              className="lg-step"
              data-has-body="true"
              data-open={openStep === "train" ? "true" : undefined}
            >
              <div className="lg-step__header">
                <button
                  type="button"
                  className="lg-step__trigger"
                  aria-expanded={openStep === "train"}
                  aria-label="Train on your website or files incomplete"
                  onClick={() => toggle("train")}
                />
                <span className="lg-step__status-icon">
                  <CircleIcon label="Train on your website or files incomplete" />
                </span>
                <span className="lg-step__label-copy">
                  <span className="lg-step__title">Train on your website or files</span>
                  <span className="lg-step__description">
                    Most teams hit 80% resolution rates from their website alone.
                  </span>
                </span>
                <span className="lg-step__chevron">
                  <ChevronIcon up={openStep === "train"} />
                </span>
              </div>
              <div
                className="lg-step__content"
                aria-hidden={openStep !== "train"}
                data-open={openStep === "train" ? "true" : undefined}
              >
                <div className="lg-step__content-inner">
                  <div className="lg-step__body">
                    <div className="lg-train-actions">
                      <button
                        type="button"
                        className="lg-btn lg-btn--primary lg-btn--sm lg-btn--left-icon"
                        onClick={onAddWebsite}
                      >
                        <span className="lg-btn__icon lg-btn__icon--left">
                          <PlusIcon />
                        </span>
                        <span className="lg-btn__content">Add website</span>
                      </button>
                      <button
                        type="button"
                        className="lg-btn lg-btn--plain lg-btn--sm"
                        onClick={onAddFiles}
                      >
                        <span className="lg-btn__content">Add files</span>
                      </button>
                    </div>
                  </div>
                  <footer />
                </div>
              </div>
            </section>

            {/* Connect channels — incomplete */}
            <section
              className="lg-step"
              data-has-body="true"
              data-open={openStep === "channels" ? "true" : undefined}
            >
              <div className="lg-step__header">
                <button
                  type="button"
                  className="lg-step__trigger"
                  aria-expanded={openStep === "channels"}
                  aria-label="Connect your channels incomplete"
                  onClick={() => toggle("channels")}
                />
                <span className="lg-step__status-icon">
                  <CircleIcon label="Connect your channels incomplete" />
                </span>
                <span className="lg-step__label-copy">
                  <span className="lg-step__title lg-step__title--bold">Connect your channels</span>
                </span>
                <span className="lg-step__chevron">
                  <ChevronIcon up={openStep === "channels"} />
                </span>
              </div>
              <div
                className="lg-step__content"
                aria-hidden={openStep !== "channels"}
                inert={openStep !== "channels" ? true : undefined}
                data-open={openStep === "channels" ? "true" : undefined}
              >
                <div className="lg-step__content-inner">
                  <div className="lg-step__body">
                    <div className="lg-channels-actions">
                      <button
                        type="button"
                        className="lg-btn lg-btn--primary lg-btn--sm"
                        onClick={onConnectChannels}
                      >
                        <span className="lg-btn__content">Connect channels</span>
                      </button>
                      <div className="lg-avatar-stack" data-testid="avatar-stack">
                        <ChannelAvatar kind="web" z={4} />
                        <ChannelAvatar kind="whatsapp" z={3} />
                        <ChannelAvatar kind="messenger" z={2} />
                        <ChannelAvatar kind="shopify" z={1} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <aside className="lg-testimonial" aria-label="Customer story">
            <span className="lg-testimonial__quote">
              “We’re resolving over 80% of customer queries without human intervention, while
              maintaining strong customer satisfaction.”
            </span>
            <div className="lg-testimonial__author">
              <span>Alexandra at</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="Stratco"
                className="lg-testimonial__company"
                height={20}
                width={80}
                src="https://cdn.static-text.com/assets/text-app/agents/ai-agent/launch-guide/stratco-logo.png"
              />
            </div>
          </aside>
        </div>

        <div className="lg-preview" aria-label="AI agent preview">
          <div className="lg-preview__widget">
            <div className="lg-preview__widget-frame" key={previewKey}>
              <WidgetPreview />
            </div>
            <button
              type="button"
              className="lg-btn lg-btn--float lg-btn--md lg-btn--icon-only lg-preview__reset"
              aria-label="Reset preview"
              onClick={() => setPreviewKey((k) => k + 1)}
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
  );
}

function WidgetPreview() {
  return (
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
            aria-labelledby="dynamic-island-aria-label"
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
                  src="https://cdn.static-text.com/assets/text-app/ai-agents/default-avatar.png"
                />
              </div>
              <div className="lg-widget__agent-meta">
                <h1>AI agent</h1>
                <span className="lg-widget__agent-sub">AI Assistant</span>
              </div>
            </div>
            <span id="dynamic-island-aria-label" aria-live="polite" className="lg-widget__sr-only">
              AI agent, Press to expand details
            </span>
          </div>
        </div>

        <div data-testid="chat-view" className="lg-widget__chat-view">
          <div id="message-list" data-testid="message-list" className="lg-widget__message-list">
            <div role="grid" aria-live="polite" aria-relevant="additions" tabIndex={-1}>
              <div data-testid="message-group-null" className="lg-widget__message-group">
                <div className="lg-widget__msg-avatar-col">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt="Current agent avatar"
                    draggable={false}
                    className="lg-widget__msg-avatar"
                    src="https://cdn.static-text.com/assets/text-app/ai-agents/default-avatar.png"
                  />
                </div>
                <div className="lg-widget__msg-col">
                  <div role="row">
                    <div data-testid="message-item" className="lg-widget__message-item">
                      <div role="gridcell" className="lg-widget__bubble" tabIndex={0}>
                        Good morning, Amp! Welcome to our preview chat—it&apos;s great to have you
                        here. How can I assist you today?
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg-widget__quick-wrap">
            <div role="row">
              <div role="gridcell" id="quick-replies-container">
                <div
                  data-testid="quick-replies"
                  className="lg-widget__quick-replies"
                  role="group"
                >
                  {QUICK_REPLIES.map((q, i) => (
                    <button key={q} type="button" value={String(i)} className="lg-widget__quick-reply">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
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
                readOnly
                rows={1}
                style={{ height: "45px" }}
              />
              <div className="lg-widget__send-wrap">
                <button
                  data-testid="send-message"
                  aria-label="Send message"
                  className="lg-widget__send"
                  disabled
                  type="button"
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
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="16" height="16" color="var(--content-locked-white)" aria-hidden="true">
      <path d="M5 12L10 17L20 7" stroke="currentcolor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CircleIcon({ label }: { label: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20" color="var(--border-basic-primary)" aria-label={label}>
      <path
        d="M3 12C3 13.1819 3.23279 14.3522 3.68508 15.4442C4.13738 16.5361 4.80031 17.5282 5.63604 18.364C6.47177 19.1997 7.46392 19.8626 8.55585 20.3149C9.64778 20.7672 10.8181 21 12 21C13.1819 21 14.3522 20.7672 15.4442 20.3149C16.5361 19.8626 17.5282 19.1997 18.364 18.364C19.1997 17.5282 19.8626 16.5361 20.3149 15.4442C20.7672 14.3522 21 13.1819 21 12C21 10.8181 20.7672 9.64778 20.3149 8.55585C19.8626 7.46392 19.1997 6.47177 18.364 5.63604C17.5282 4.80031 16.5361 4.13738 15.4442 3.68508C14.3522 3.23279 13.1819 3 12 3C10.8181 3 9.64778 3.23279 8.55585 3.68508C7.46392 4.13738 6.47177 4.80031 5.63604 5.63604C4.80031 6.47177 4.13738 7.46392 3.68508 8.55585C3.23279 9.64778 3 10.8181 3 12Z"
        stroke="currentcolor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronIcon({ up }: { up: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="24" height="24" aria-hidden="true">
      <path
        d={up ? "M6 15L12 9L18 15" : "M6 9L12 15L18 9"}
        stroke="currentcolor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20" aria-hidden="true">
      <path d="M5 12H19M12 5V19" stroke="currentcolor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20" aria-hidden="true">
      <path d="M19 12L5 12M19 12L15 8M19 12L15 16" stroke="currentcolor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlayCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20" aria-hidden="true">
      <path d="M15 12L11 9V15L15 12Z" stroke="currentcolor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M3 12C3 13.1819 3.23279 14.3522 3.68508 15.4442C4.13738 16.5361 4.80031 17.5282 5.63604 18.364C6.47177 19.1997 7.46392 19.8626 8.55585 20.3149C9.64778 20.7672 10.8181 21 12 21C13.1819 21 14.3522 20.7672 15.4442 20.3149C16.5361 19.8626 17.5282 19.1997 18.364 18.364C19.1997 17.5282 19.8626 16.5361 20.3149 15.4442C20.7672 14.3522 21 13.1819 21 12C21 10.8181 20.7672 9.64778 20.3149 8.55585C19.8626 7.46392 19.1997 6.47177 18.364 5.63604C17.5282 4.80031 16.5361 4.13738 15.4442 3.68508C14.3522 3.23279 13.1819 3 12 3C10.8181 3 9.64778 3.23279 8.55585 3.68508C7.46392 4.13738 6.47177 4.80031 5.63604 5.63604C4.80031 6.47177 4.13738 7.46392 3.68508 8.55585C3.23279 9.64778 3 10.8181 3 12Z"
        stroke="currentcolor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SkillIcon({ kind }: { kind: "user" | "transfer" | "ticket" | "wave" }) {
  if (kind === "user") {
    return (
      <svg viewBox="0 0 24 24" fill="none" width="20" height="20" aria-hidden="true">
        <path d="M8 7C8 8.06087 8.42143 9.07828 9.17157 9.82843C9.92172 10.5786 10.9391 11 12 11C13.0609 11 14.0783 10.5786 14.8284 9.82843C15.5786 9.07828 16 8.06087 16 7C16 5.93913 15.5786 4.92172 14.8284 4.17157C14.0783 3.42143 13.0609 3 12 3C10.9391 3 9.92172 3.42143 9.17157 4.17157C8.42143 4.92172 8 5.93913 8 7Z" stroke="currentcolor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6 21V19C6 17.9391 6.42143 16.9217 7.17157 16.1716C7.92172 15.4214 8.93913 15 10 15H14C15.0609 15 16.0783 15.4214 16.8284 16.1716C17.5786 16.9217 18 17.9391 18 19V21" stroke="currentcolor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === "transfer") {
    return (
      <svg viewBox="0 0 24 24" fill="none" width="20" height="20" aria-hidden="true">
        <path d="M4 13C4.24456 14.7598 5.06093 16.3903 6.32336 17.6405C7.58579 18.8907 9.22424 19.6911 10.9863 19.9184C12.7484 20.1458 14.5364 19.7875 16.0748 18.8988C17.6132 18.01 18.8168 16.6401 19.5 15M20 19V15H16M20 11C19.7554 9.24017 18.9391 7.60961 17.6766 6.35945C16.4142 5.10928 14.7758 4.30887 13.0137 4.0815C11.2516 3.85414 9.46362 4.21243 7.9252 5.1012C6.38678 5.98996 5.18325 7.35989 4.5 8.99995M4 4.99995V8.99995H8M11 12C11 12.2652 11.1054 12.5196 11.2929 12.7071C11.4804 12.8946 11.7348 13 12 13C12.2652 13 12.5196 12.8946 12.7071 12.7071C12.8946 12.5196 13 12.2652 13 12C13 11.7348 12.8946 11.4804 12.7071 11.2929C12.5196 11.1054 12.2652 11 12 11C11.7348 11 11.4804 11.1054 11.2929 11.2929C11.1054 11.4804 11 11.7348 11 12Z" stroke="currentcolor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === "ticket") {
    return (
      <svg viewBox="0 0 24 24" fill="none" width="20" height="20" aria-hidden="true">
        <path d="M15 5V7M15 11V13M15 17V19M5 5H19C19.5304 5 20.0391 5.21071 20.4142 5.58579C20.7893 5.96086 21 6.46957 21 7V10C20.4696 10 19.9609 10.2107 19.5858 10.5858C19.2107 10.9609 19 11.4696 19 12C19 12.5304 19.2107 13.0391 19.5858 13.4142C19.9609 13.7893 20.4696 14 21 14V17C21 17.5304 20.7893 18.0391 20.4142 18.4142C20.0391 18.7893 19.5304 19 19 19H5C4.46957 19 3.96086 18.7893 3.58579 18.4142C3.21071 18.0391 3 17.5304 3 17V14C3.53043 14 4.03914 13.7893 4.41421 13.4142C4.78929 13.0391 5 12.5304 5 12C5 11.4696 4.78929 10.9609 4.41421 10.5858C4.03914 10.2107 3.53043 10 3 10V7C3 6.46957 3.21071 5.96086 3.58579 5.58579C3.96086 5.21071 4.46957 5 5 5Z" stroke="currentcolor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20" aria-hidden="true">
      <path d="M18.5479 9.72246C18.7468 9.37793 19.0744 9.12653 19.4587 9.02357C19.843 8.9206 20.2524 8.97451 20.5969 9.17342C20.9415 9.37233 21.1929 9.69996 21.2958 10.0842C21.3988 10.4685 21.3449 10.8779 21.146 11.2225L16.896 18.5837C16.1003 19.9618 14.7898 20.9674 13.2527 21.3792C11.7157 21.7911 10.0779 21.5755 8.69982 20.7798L6.96777 19.7798L7.1479 19.8838C6.28728 19.3871 5.56349 18.6845 5.04152 17.839C4.51955 16.9934 4.21574 16.0315 4.15739 15.0396C4.1505 14.9203 4.14392 14.801 4.13764 14.6817C4.10694 14.1109 4.11315 11.9102 4.15588 8.07816C4.16023 7.68753 4.3168 7.314 4.5923 7.03703C4.86779 6.76006 5.24047 6.60149 5.63107 6.59505C6.04721 6.58805 6.45375 6.72028 6.78613 6.97076C7.11851 7.22124 7.35766 7.57559 7.46561 7.97754L8.00367 9.9856L11.7539 3.49049C11.9529 3.14596 12.2805 2.89457 12.6648 2.7916C13.049 2.68864 13.4585 2.74254 13.803 2.94145C14.1475 3.14036 14.3989 3.46799 14.5019 3.85226C14.6048 4.23653 14.551 4.64608 14.3521 4.99061M14.3521 4.99061L15.3521 3.25856C15.4506 3.08796 15.5817 2.93844 15.738 2.81853C15.8943 2.69861 16.0726 2.61065 16.2629 2.55967C16.4532 2.50868 16.6516 2.49568 16.8469 2.52139C17.0422 2.5471 17.2305 2.61103 17.4011 2.70952C17.5717 2.80801 17.7212 2.93914 17.8412 3.09541C17.9611 3.25169 18.049 3.43006 18.1 3.62033C18.151 3.8106 18.164 4.00905 18.1383 4.20435C18.1126 4.39964 18.0487 4.58796 17.9502 4.75856L13.7002 12.1198M14.3521 4.99061L11.3813 9.98568M16.9502 6.49049C17.1491 6.14596 17.4768 5.89457 17.861 5.7916C18.2453 5.68864 18.6547 5.74254 18.9993 5.94145C19.3438 6.14036 19.5952 6.46799 19.6982 6.85226C19.8011 7.23653 19.7472 7.64596 19.5483 7.99049L16.2983 13.6197" stroke="currentcolor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChannelAvatar({ kind, z }: { kind: "web" | "whatsapp" | "messenger" | "shopify"; z: number }) {
  return (
    <div className="lg-avatar-stack__item" style={{ zIndex: z }} data-testid="avatar-stack-item">
      <div className="lg-avatar lg-avatar--sm">
        {kind === "web" && (
          <svg viewBox="0 0 24 24" fill="none" width="20" height="20" aria-hidden="true">
            <path d="M3.6001 9H20.4001M3.6001 15H20.4001M11.5002 3C9.8155 5.69961 8.92236 8.81787 8.92236 12C8.92236 15.1821 9.8155 18.3004 11.5002 21M12.5 3C14.1847 5.69961 15.0778 8.81787 15.0778 12C15.0778 15.1821 14.1847 18.3004 12.5 21M3 12C3 13.1819 3.23279 14.3522 3.68508 15.4442C4.13738 16.5361 4.80031 17.5282 5.63604 18.364C6.47177 19.1997 7.46392 19.8626 8.55585 20.3149C9.64778 20.7672 10.8181 21 12 21C13.1819 21 14.3522 20.7672 15.4442 20.3149C16.5361 19.8626 17.5282 19.1997 18.364 18.364C19.1997 17.5282 19.8626 16.5361 20.3149 15.4442C20.7672 14.3522 21 13.1819 21 12C21 10.8181 20.7672 9.64778 20.3149 8.55585C19.8626 7.46392 19.1997 6.47177 18.364 5.63604C17.5282 4.80031 16.5361 4.13738 15.4442 3.68508C14.3522 3.23279 13.1819 3 12 3C10.8181 3 9.64778 3.23279 8.55585 3.68508C7.46392 4.13738 6.47177 4.80031 5.63604 5.63604C4.80031 6.47177 4.13738 7.46392 3.68508 8.55585C3.23279 9.64778 3 10.8181 3 12Z" stroke="currentcolor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {kind === "whatsapp" && (
          <svg fill="none" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              fill="#25d366"
              fillRule="evenodd"
              clipRule="evenodd"
              d="m19.0859 4.90629c-1.8798-1.87322-4.38-2.90534-7.0439-2.90629-5.48917 0-9.95653 4.44545-9.95844 9.9097-.00095 1.7468.45791 3.4518 1.32932 4.9544l-1.41288 5.1359 5.27909-1.3781c1.45441.7898 3.09221 1.2056 4.75861 1.2061h.0043c5.4882 0 9.9561-4.446 9.958-9.9102.0009-2.64824-1.0338-5.13781-2.9141-7.01103zm-7.0439 15.24801h-.0033c-1.485-.0004-2.94181-.3977-4.21287-1.148l-.30226-.1787-3.13279.8178.83608-3.0398-.19673-.3118c-.82844-1.3115-1.2663-2.8274-1.26534-4.3836.00191-4.54144 3.71484-8.23656 8.28061-8.23656 2.2107.00095 4.2888.85868 5.8515 2.41589 1.5629 1.55674 2.4228 3.62671 2.4219 5.82727-.002 4.542-3.7149 8.2371-8.2768 8.2371zm4.5399-6.1689c-.2487-.124-1.472-.7228-1.7003-.8055-.2282-.0827-.3939-.124-.5596.124-.1657.2481-.6427.806-.7878.9709-.1452.1653-.2904.1858-.5391.0617-.2488-.124-1.0505-.3854-2.0012-1.2288-.7396-.6568-1.23907-1.4674-1.38418-1.7155-.14516-.248-.01528-.382.10884-.5051.11172-.1112.24877-.2894.37334-.4339.1247-.1444.1658-.248.2488-.4129.0831-.16539.0416-.3098-.0205-.43387-.0621-.12401-.55959-1.34291-.76731-1.83852-.202-.48279-.40728-.41721-.55961-.42529-.14517-.00713-.31084-.00855-.477-.00855-.16617 0-.4355.06177-.66372.30983-.22823.24802-.87094.84724-.87094 2.06564 0 1.21836.89149 2.39646 1.0161 2.56186.12461.1653 1.75472 2.6663 4.25058 3.7393.5935.2551 1.0571.4077 1.4186.5217.5959.1887 1.1383.1621 1.5671.0984.478-.0713 1.4721-.5992 1.6793-1.1776.2073-.5783.2073-1.0744.1452-1.1775s-.2282-.1654-.477-.2894z"
            />
          </svg>
        )}
        {kind === "messenger" && (
          <svg viewBox="0 0 24 24" fill="none" width="20" height="20" aria-hidden="true">
            <path d="M21.9604 11.7014C21.9604 17.2528 17.611 21.3627 12.0002 21.3627C10.9926 21.3627 10.0257 21.2297 9.11693 20.9799C8.94044 20.9309 8.75279 20.9448 8.58506 21.0185L6.60817 21.8914C6.09104 22.1197 5.50737 21.752 5.49024 21.1871L5.43605 19.4149C5.42928 19.1966 5.33127 18.9926 5.16833 18.8472C3.23008 17.1141 2.04004 14.6054 2.04004 11.7014C2.04004 6.15 6.38944 2.04004 12.0002 2.04004C17.611 2.04004 21.9604 6.15 21.9604 11.7014Z" fill="#0866FF" />
            <path d="M14.7046 14.4827L18.1723 9.12331C18.5209 8.58466 17.8751 7.95757 17.3468 8.32211L13.7269 10.8189C13.605 10.903 13.444 10.9054 13.3197 10.8249L10.1066 8.74602C9.83446 8.56992 9.47151 8.64801 9.29582 8.91972L5.82769 14.2791C5.47908 14.8177 6.1249 15.4448 6.65319 15.0803L10.2739 12.5831C10.3958 12.499 10.5568 12.4966 10.6811 12.5771L13.8934 14.6556C14.1655 14.8317 14.5285 14.7544 14.7046 14.4827Z" fill="white" />
          </svg>
        )}
        {kind === "shopify" && (
          <svg viewBox="0 0 24 25" fill="none" width="20" height="20" aria-hidden="true">
            <path d="M18.0818 6.77835C18.068 6.67835 17.9804 6.62301 17.908 6.61691C17.8358 6.61088 16.3064 6.49753 16.3064 6.49753C16.3064 6.49753 15.2443 5.44307 15.1277 5.32636C15.0111 5.20972 14.7833 5.24519 14.6948 5.27122C14.6818 5.27506 14.4628 5.34266 14.1005 5.45478C13.7457 4.43382 13.1195 3.4956 12.0179 3.4956C11.9875 3.4956 11.9562 3.49683 11.9249 3.49861C11.6116 3.0843 11.2235 2.9043 10.8883 2.9043C8.32221 2.9043 7.09625 6.11218 6.71186 7.74233C5.71474 8.0513 5.00638 8.27096 4.9159 8.29938C4.35932 8.47397 4.34172 8.49151 4.26863 9.01596C4.21363 9.41302 2.75732 20.6753 2.75732 20.6753L14.1052 22.8015L20.2538 21.4713C20.2538 21.4713 18.0954 6.87835 18.0818 6.77835H18.0818Z" fill="#95BF46" />
          </svg>
        )}
      </div>
    </div>
  );
}
