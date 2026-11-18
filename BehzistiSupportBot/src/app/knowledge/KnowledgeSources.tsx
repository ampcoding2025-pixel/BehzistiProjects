"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { LaunchGuide } from "./LaunchGuide";
import { Overview } from "./Overview";
import "./knowledge.css";
import "./launch-guide.css";
import "./overview.css";

type SourceType = "all" | "didban" | "faq" | "file" | "url";

type KnowledgeSource = {
  id: string;
  type: Exclude<SourceType, "all">;
  title: string;
  meta: string;
};

type NavId = "launch-guide" | "overview" | "profile" | "skills" | "knowledge" | "copilot";

const FILTERS: Array<{ id: SourceType; label: string }> = [
  { id: "all", label: "All" },
  { id: "didban", label: "Didban" },
  { id: "faq", label: "FAQ" },
  { id: "file", label: "File" },
  { id: "url", label: "Website" },
];

const SIDE_NAV: Array<{ id: NavId; label: string; badge?: string }> = [
  { id: "launch-guide", label: "Launch guide" },
  { id: "overview", label: "Overview" },
  { id: "profile", label: "Profile" },
  { id: "skills", label: "Skills" },
  { id: "knowledge", label: "Knowledge", badge: "!" },
];

export function KnowledgeSources() {
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [filter, setFilter] = useState<SourceType>("all");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState<"header" | "empty" | null>(null);
  const [activeNav, setActiveNav] = useState<NavId>("launch-guide");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const html = document.documentElement;
    const prevDir = html.getAttribute("dir");
    const prevLang = html.getAttribute("lang");
    html.setAttribute("dir", "ltr");
    html.setAttribute("lang", "en");
    return () => {
      if (prevDir) html.setAttribute("dir", prevDir);
      else html.removeAttribute("dir");
      if (prevLang) html.setAttribute("lang", prevLang);
      else html.removeAttribute("lang");
    };
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setPickerOpen(false);
        setMenuOpen(null);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = useMemo(
    () => (filter === "all" ? sources : sources.filter((s) => s.type === filter)),
    [sources, filter],
  );

  const filterCount = filter === "all" ? sources.length : filtered.length;
  const filterLabel = `${FILTERS.find((f) => f.id === filter)?.label ?? "All"} (${filterCount})`;
  const needsSetup = sources.length === 0;

  function addSource(type: Exclude<SourceType, "all">) {
    const titles: Record<Exclude<SourceType, "all">, string> = {
      didban: "Didban historical answers",
      faq: "FAQ collection",
      file: "Uploaded document",
      url: "Website source",
    };
    setSources((prev) => [
      {
        id: `${type}-${Date.now()}`,
        type,
        title: titles[type],
        meta: `Added ${new Date().toLocaleString("en-US")}`,
      },
      ...prev,
    ]);
    setMenuOpen(null);
    setFilter("all");
  }

  return (
    <div className="kn-app" ref={rootRef}>
      <div className="kn-app-frame">
        {/* Left app rail */}
        <aside className="kn-rail" aria-label="App navigation">
          <div className="kn-rail__logo" title="LiveChat">
            LC
          </div>
          <button type="button" className="kn-rail__item" title="Chats" aria-label="Chats">
            <RailIcon kind="chats" />
          </button>
          <button type="button" className="kn-rail__item" title="Customers" aria-label="Customers">
            <RailIcon kind="customers" />
          </button>
          <button type="button" className="kn-rail__item is-active" title="AI Agent" aria-label="AI Agent">
            <RailIcon kind="ai" />
          </button>
          <button type="button" className="kn-rail__item" title="Reports" aria-label="Reports">
            <RailIcon kind="reports" />
          </button>
          <div className="kn-rail__spacer" />
          <button type="button" className="kn-rail__item" title="Settings" aria-label="Settings">
            <RailIcon kind="gear" />
          </button>
        </aside>

        <div className="kn-page-wrapper">
          <div>
            <audio preload="auto" id="sound-message" />
            <audio preload="auto" id="sound-incoming_chat" />
            <audio preload="auto" id="sound-queued_visitor" />
            <audio preload="auto" id="sound-returning_visitor" />
            <audio preload="auto" id="sound-new_visitor" />
          </div>

          <div className="kn-nav-bar-wrapper" aria-hidden="true" />

          <div className="kn-page-content">
            <div className="kn-agent-detail-layout">
              {/* Contextual side navigation — LiveChat AI Agent */}
              <aside className="kn-side-nav" aria-label="AI Agent">
                <div className="kn-side-nav__content">
                  <div className="kn-side-nav__agent-field">
                    <div className="kn-side-nav__avatar kn-side-nav__avatar--with-status">
                      <span
                        className="kn-side-nav__status kn-side-nav__status--accept"
                        role="status"
                        data-testid="avatar__status"
                      />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        alt="AI agent"
                        className="kn-side-nav__avatar-img"
                        src="https://cdn.static-text.com/assets/text-app/ai-agents/default-avatar.png"
                      />
                    </div>
                    <div className="kn-side-nav__agent-name">
                      <div data-testid="tooltip-trigger">
                        <div className="kn-text">AI agent</div>
                      </div>
                    </div>
                  </div>

                  {SIDE_NAV.map((item) => {
                    const isActive = activeNav === item.id;
                    const showBadge = item.id === "knowledge" && needsSetup;
                    return (
                      <div
                        key={item.id}
                        className="kn-side-nav__item"
                        data-active={isActive ? "true" : "false"}
                        data-testid={
                          isActive
                            ? "side-navigation-active-item-test-id"
                            : "side-navigation-item-test-id"
                        }
                      >
                        <button
                          type="button"
                          className={`kn-side-nav__anchor${isActive ? " is-active" : ""}`}
                          aria-current={isActive ? "page" : undefined}
                          onClick={() => setActiveNav(item.id)}
                        >
                          <span className="kn-side-nav__left-node" data-testid="side-navigation-parent-icon">
                            <NavIcon id={item.id} />
                          </span>
                          <span className={`kn-side-nav__label${isActive ? " is-active" : ""}`}>
                            <div data-testid="tooltip-trigger">
                              <div className="kn-text">{item.label}</div>
                            </div>
                          </span>
                          <span className="kn-side-nav__right-node">
                            {showBadge ? (
                              <span
                                className="kn-side-nav__badge"
                                role="img"
                                aria-label="No knowledge added"
                              >
                                !
                              </span>
                            ) : null}
                          </span>
                        </button>
                      </div>
                    );
                  })}

                  <div className="kn-side-nav__divider">
                    <div className="kn-side-nav__divider-line" data-testid="divider-line-left" />
                    <div className="kn-side-nav__divider-line" data-testid="divider-line-right" />
                  </div>

                  <div
                    className="kn-side-nav__item"
                    data-active={activeNav === "copilot" ? "true" : "false"}
                    data-testid="side-navigation-item-test-id"
                  >
                    <button
                      type="button"
                      className={`kn-side-nav__anchor${activeNav === "copilot" ? " is-active" : ""}`}
                      onClick={() => setActiveNav("copilot")}
                    >
                      <span className="kn-side-nav__left-node" data-testid="side-navigation-parent-icon">
                        <NavIcon id="copilot" />
                      </span>
                      <span className="kn-side-nav__label">
                        <div data-testid="tooltip-trigger">
                          <div className="kn-text">Copilot</div>
                        </div>
                      </span>
                      <span className="kn-side-nav__right-node" />
                    </button>
                  </div>
                </div>

                <Link href="/" className="kn-side-nav__back">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M15 18L9 12L15 6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Back
                </Link>
              </aside>

              <div
                className={`kn-agent-main${
                  activeNav === "launch-guide"
                    ? " kn-agent-main--overview"
                    : activeNav === "overview"
                      ? " kn-agent-main--overview-page"
                      : ""
                }`}
              >
                {activeNav === "launch-guide" ? (
                  <LaunchGuide
                    onAddWebsite={() => setActiveNav("knowledge")}
                    onAddFiles={() => setActiveNav("knowledge")}
                    onConnectChannels={() => setActiveNav("overview")}
                  />
                ) : activeNav === "overview" ? (
                  <Overview
                    knowledgeCount={sources.length}
                    skillsCount={4}
                    onManageKnowledge={() => setActiveNav("knowledge")}
                    onBrowseSkills={() => setActiveNav("skills")}
                    onOpenProfile={() => setActiveNav("profile")}
                  />
                ) : activeNav === "knowledge" ? (
                  <>
                    <div className="kn-content-header">
                      <h5 className="kn-content-header__title">Knowledge</h5>
                      <div className="kn-content-header__right-node">
                        <div className="kn-agent-section-header__actions">
                          <div data-testid="tooltip-trigger">
                            {needsSetup ? (
                              <div className="kn-tag kn-tag--lg kn-tag--warning" data-testid="lc-tag">
                                <div className="kn-tag__content-wrapper">
                                  <div className="kn-tag__node" data-testid="lc-tag-left-node">
                                    <span className="kn-icon">
                                      <svg
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                        role="img"
                                        width="20"
                                        height="20"
                                        aria-hidden="true"
                                      >
                                        <path
                                          d="M12 8V12M12 16H12.01M3 12C3 13.1819 3.23279 14.3522 3.68508 15.4442C4.13738 16.5361 4.80031 17.5282 5.63604 18.364C6.47177 19.1997 7.46392 19.8626 8.55585 20.3149C9.64778 20.7672 10.8181 21 12 21C13.1819 21 14.3522 20.7672 15.4442 20.3149C16.5361 19.8626 17.5282 19.1997 18.364 18.364C19.1997 17.5282 19.8626 16.5361 20.3149 15.4442C20.7672 14.3522 21 13.1819 21 12C21 10.8181 20.7672 9.64778 20.3149 8.55585C19.8626 7.46392 19.1997 6.47177 18.364 5.63604C17.5282 4.80031 16.5361 4.13738 15.4442 3.68508C14.3522 3.23279 13.1819 3 12 3C10.8181 3 9.64778 3.23279 8.55585 3.68508C7.46392 4.13738 6.47177 4.80031 5.63604 5.63604C4.80031 6.47177 4.13738 7.46392 3.68508 8.55585C3.23279 9.64778 3 10.8181 3 12Z"
                                          stroke="currentcolor"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        />
                                      </svg>
                                    </span>
                                  </div>
                                  <div className="kn-tag__content">Needs setup</div>
                                </div>
                              </div>
                            ) : (
                              <div
                                className="kn-tag kn-tag--lg"
                                style={{ background: "#d1f4d5", color: "#007031" }}
                              >
                                <div className="kn-tag__content-wrapper">
                                  <div className="kn-tag__content">Ready</div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="kn-agent-detail-layout__content">
                      <div className="kn-sources-grid-container">
                        <div className="kn-sources-grid">
                          <div className="kn-column kn-column--full-height">
                            <div className="kn-sources-content">
                              <div className="kn-sources-header">
                                <div className="kn-sources-header__navigation">
                                  <div className="kn-single-picker" data-testid="picker-wrapper">
                                    <div className="kn-form-field-content">
                                      <button
                                        aria-label={filterLabel}
                                        className="kn-picker-trigger"
                                        type="button"
                                        tabIndex={0}
                                        aria-expanded={pickerOpen}
                                        aria-haspopup="listbox"
                                        role="combobox"
                                        onClick={() => {
                                          setPickerOpen((v) => !v);
                                          setMenuOpen(null);
                                        }}
                                      >
                                        <div className="kn-picker-trigger__content kn-picker-trigger__content--medium">
                                          <div
                                            className="kn-picker-trigger__content-container"
                                            style={{ height: 24 }}
                                          >
                                            <div className="kn-picker-trigger-item__content kn-picker-trigger-item__content--medium">
                                              <div data-testid="tooltip-trigger">
                                                <div className="kn-text">{filterLabel}</div>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                        <div className="kn-picker-trigger__controls kn-picker-trigger__controls--medium">
                                          <span
                                            aria-hidden="true"
                                            className="kn-animated-chevron kn-animated-chevron--md kn-picker-trigger__chevron-icon"
                                            data-testid="trigger-chevron"
                                          >
                                            <span className="kn-animated-chevron__line kn-animated-chevron__line--left" />
                                            <span className="kn-animated-chevron__line kn-animated-chevron__line--right" />
                                          </span>
                                        </div>
                                      </button>
                                      {pickerOpen && (
                                        <div className="kn-picker-menu" role="listbox">
                                          {FILTERS.map((f) => {
                                            const count =
                                              f.id === "all"
                                                ? sources.length
                                                : sources.filter((s) => s.type === f.id).length;
                                            return (
                                              <button
                                                key={f.id}
                                                type="button"
                                                role="option"
                                                className={`kn-picker-option${filter === f.id ? " is-active" : ""}`}
                                                onClick={() => {
                                                  setFilter(f.id);
                                                  setPickerOpen(false);
                                                }}
                                              >
                                                {f.label} ({count})
                                              </button>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="kn-sources-header__add-source">
                                  <div className="kn-action-menu" data-testid="action-menu-trigger-button">
                                    <button
                                      aria-disabled="false"
                                      className="kn-btn kn-btn--primary kn-btn--sm kn-btn--with-left-icon"
                                      type="button"
                                      aria-expanded={menuOpen === "header"}
                                      aria-haspopup="menu"
                                      aria-label="add-source"
                                      onClick={() => {
                                        setMenuOpen((m) => (m === "header" ? null : "header"));
                                        setPickerOpen(false);
                                      }}
                                    >
                                      <span className="kn-btn__icon kn-btn__icon--left kn-icon">
                                        <svg
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          xmlns="http://www.w3.org/2000/svg"
                                          role="img"
                                          width="20"
                                          height="20"
                                          aria-label="add-source-icon"
                                        >
                                          <path
                                            d="M5 12H19M12 5V19"
                                            stroke="currentcolor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          />
                                        </svg>
                                      </span>
                                      <div className="kn-btn__content">New source</div>
                                    </button>
                                    {menuOpen === "header" && (
                                      <div className="kn-action-menu__list" role="menu">
                                        <AddSourceItems onPick={addSource} />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="kn-sources-content__body">
                                {filtered.length === 0 ? (
                                  <div className="kn-empty-state kn-empty-state--full kn-empty-state--centered">
                                    <div className="kn-empty-state__icon--full" data-testid="icon">
                                      <span className="kn-icon">
                                        <svg
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          xmlns="http://www.w3.org/2000/svg"
                                          role="img"
                                          width="48"
                                          height="48"
                                          color="var(--content-basic-secondary)"
                                          aria-hidden="true"
                                        >
                                          <path
                                            d="M12 5.99996C10.6318 5.21005 9.07983 4.79419 7.5 4.79419C5.92017 4.79419 4.36817 5.21005 3 5.99996V19C4.36817 18.21 5.92017 17.7942 7.5 17.7942C9.07983 17.7942 10.6318 18.2101 12 19M12 5.99996C13.3682 5.21005 14.9202 4.79419 16.5 4.79419C18.0798 4.79419 19.6318 5.21009 21 6V19C19.6318 18.2101 18.0798 17.7942 16.5 17.7942C14.9202 17.7942 13.3682 18.2101 12 19M12 5.99996V19"
                                            stroke="currentcolor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          />
                                        </svg>
                                      </span>
                                    </div>
                                    <h4 className="kn-empty-state__title">Teach AI Agent your business</h4>
                                    <span className="kn-empty-state__description">
                                      Add your docs, FAQs, or policies. AI Agent will use your content to
                                      convert conversations.
                                    </span>
                                    <div className="kn-empty-state__actions">
                                      <div
                                        className="kn-action-menu"
                                        data-testid="action-menu-trigger-button"
                                      >
                                        <button
                                          aria-disabled="false"
                                          className="kn-btn kn-btn--primary kn-btn--sm"
                                          type="button"
                                          aria-expanded={menuOpen === "empty"}
                                          aria-haspopup="menu"
                                          aria-label="add-source"
                                          onClick={() => {
                                            setMenuOpen((m) => (m === "empty" ? null : "empty"));
                                            setPickerOpen(false);
                                          }}
                                        >
                                          <div className="kn-btn__content">Add source</div>
                                        </button>
                                        {menuOpen === "empty" && (
                                          <div
                                            className="kn-action-menu__list kn-action-menu__list--center"
                                            role="menu"
                                          >
                                            <AddSourceItems onPick={addSource} />
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="kn-sources-list">
                                    {filtered.map((s) => (
                                      <article key={s.id} className="kn-source-card">
                                        <span className="kn-source-card__type">{s.type}</span>
                                        <h3 className="kn-source-card__title">{s.title}</h3>
                                        <p className="kn-source-card__meta">{s.meta}</p>
                                      </article>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="lg-content">
                    <h1 className="lg-heading">
                      {SIDE_NAV.find((n) => n.id === activeNav)?.label ?? "Section"}
                    </h1>
                    <p style={{ color: "var(--content-basic-secondary)", margin: 0 }}>
                      This section matches the LiveChat navigation placeholder for now.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddSourceItems({
  onPick,
}: {
  onPick: (type: Exclude<SourceType, "all">) => void;
}) {
  return (
    <>
      <button
        type="button"
        className="kn-action-menu__item"
        role="menuitem"
        onClick={() => onPick("didban")}
      >
        Didban answers
        <span className="kn-action-menu__hint">Historical CookieFlowReplyCitizen replies</span>
      </button>
      <button
        type="button"
        className="kn-action-menu__item"
        role="menuitem"
        onClick={() => onPick("faq")}
      >
        FAQ
        <span className="kn-action-menu__hint">Frequently asked questions</span>
      </button>
      <button
        type="button"
        className="kn-action-menu__item"
        role="menuitem"
        onClick={() => onPick("file")}
      >
        Upload file
        <span className="kn-action-menu__hint">PDF / DOCX / TXT</span>
      </button>
      <button
        type="button"
        className="kn-action-menu__item"
        role="menuitem"
        onClick={() => onPick("url")}
      >
        Website URL
        <span className="kn-action-menu__hint">Public or internal docs page</span>
      </button>
    </>
  );
}

function RailIcon({ kind }: { kind: "chats" | "customers" | "ai" | "reports" | "gear" }) {
  const paths: Record<typeof kind, string> = {
    chats:
      "M21 11.5C21 16.194 16.97 20 12 20C10.98 20 10.01 19.84 9.11 19.55L4 21L5.55 16.72C4.57 15.29 4 13.46 4 11.5C4 6.806 8.03 3 13 3C17.97 3 21 6.806 21 11.5Z",
    customers:
      "M17 21V19C17 16.79 15.21 15 13 15H5C2.79 15 1 16.79 1 19V21M16 3.13C17.74 3.58 19 5.17 19 7C19 8.83 17.74 10.42 16 10.87M9 11C11.21 11 13 9.21 13 7C13 4.79 11.21 3 9 3C6.79 3 5 4.79 5 7C5 9.21 6.79 11 9 11Z",
    ai: "M12 2L14.4 8.4L21 9.3L16 14L17.5 21L12 17.8L6.5 21L8 14L3 9.3L9.6 8.4L12 2Z",
    reports:
      "M4 19V5M4 19H20M4 19L10 13L14 16L20 9",
    gear: "M12 15.5C13.93 15.5 15.5 13.93 15.5 12C15.5 10.07 13.93 8.5 12 8.5C10.07 8.5 8.5 10.07 8.5 12C8.5 13.93 10.07 15.5 12 15.5Z",
  };
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={paths[kind]}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function NavIcon({ id }: { id: NavId }) {
  if (id === "copilot") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 3L14.5 8.5L20.5 9.5L16 13.5L17.5 19.5L12 16.5L6.5 19.5L8 13.5L3.5 9.5L9.5 8.5L12 3Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  const d: Record<Exclude<NavId, "copilot">, string> = {
    "launch-guide":
      "M12 5V3M12 13V9M12 22V17M9 5H19L21 7L19 9H9C8.73478 9 8.48043 8.89464 8.29289 8.70711C8.10536 8.51957 8 8.26522 8 8V6C8 5.73478 8.10536 5.48043 8.29289 5.29289C8.48043 5.10536 8.73478 5 9 5ZM13 13H6L4 15L6 17H13C13.2652 17 13.5196 16.8946 13.7071 16.7071C13.8946 16.5196 14 16.2652 14 16V14C14 13.7348 13.8946 13.4804 13.7071 13.2929C13.5196 13.1054 13.2652 13 13 13Z",
    overview:
      "M13.4101 10.59L16.0002 8M7 12C7 10.6739 7.52679 9.40215 8.46447 8.46447C9.40215 7.52679 10.6739 7 12 7M3 12C3 13.1819 3.23279 14.3522 3.68508 15.4441C4.13738 16.5361 4.80031 17.5283 5.63604 18.3639C6.47176 19.1997 7.46392 19.8625 8.55585 20.3149C9.64777 20.7672 10.8181 21 12 21C13.1819 21 14.3522 20.7672 15.4441 20.3149C16.5361 19.8625 17.5283 19.1997 18.3639 18.3639C19.1997 17.5283 19.8625 16.5361 20.3149 15.4441C20.7672 14.3522 21 13.1819 21 12C21 10.8181 20.7672 9.64777 20.3149 8.55585C19.8625 7.46392 19.1997 6.47176 18.3639 5.63604C17.5283 4.80031 16.5361 4.13738 15.4441 3.68508C14.3522 3.23279 13.1819 3 12 3C10.8181 3 9.64777 3.23279 8.55585 3.68508C7.46392 4.13738 6.47176 4.80031 5.63604 5.63604C4.80031 6.47176 4.13738 7.46392 3.68508 8.55585C3.23279 9.64777 3 10.8181 3 12ZM11 12C11 12.2652 11.1054 12.5196 11.2929 12.7071C11.4804 12.8946 11.7348 13 12 13C12.2652 13 12.5196 12.8946 12.7071 12.7071C12.8946 12.5196 13 12.2652 13 12C13 11.7348 12.8946 11.4804 12.7071 11.2929C12.5196 11.1054 12.2652 11 12 11C11.7348 11 11.4804 11.1054 11.2929 11.2929C11.1054 11.4804 11 11.7348 11 12Z",
    profile:
      "M8 7C8 8.06087 8.42143 9.07828 9.17157 9.82843C9.92172 10.5786 10.9391 11 12 11C13.0609 11 14.0783 10.5786 14.8284 9.82843C15.5786 9.07828 16 8.06087 16 7C16 5.93913 15.5786 4.92172 14.8284 4.17157C14.0783 3.42143 13.0609 3 12 3C10.9391 3 9.92172 3.42143 9.17157 4.17157C8.42143 4.92172 8 5.93913 8 7ZM6 21V19C6 17.9391 6.42143 16.9217 7.17157 16.1716C7.92172 15.4214 8.93913 15 10 15H14C15.0609 15 16.0783 15.4214 16.8284 16.1716C17.5786 16.9217 18 17.9391 18 19V21",
    skills:
      "M15 12L11 9V15L15 12ZM3 12C3 13.1819 3.23279 14.3522 3.68508 15.4442C4.13738 16.5361 4.80031 17.5282 5.63604 18.364C6.47177 19.1997 7.46392 19.8626 8.55585 20.3149C9.64778 20.7672 10.8181 21 12 21C13.1819 21 14.3522 20.7672 15.4442 20.3149C16.5361 19.8626 17.5282 19.1997 18.364 18.364C19.1997 17.5282 19.8626 16.5361 20.3149 15.4442C20.7672 14.3522 21 13.1819 21 12C21 10.8181 20.7672 9.64778 20.3149 8.55585C19.8626 7.46392 19.1997 6.47177 18.364 5.63604C17.5282 4.80031 16.5361 4.13738 15.4442 3.68508C14.3522 3.23279 13.1819 3 12 3C10.8181 3 9.64778 3.23279 8.55585 3.68508C7.46392 4.13738 6.47177 4.80031 5.63604 5.63604C4.80031 6.47177 4.13738 7.46392 3.68508 8.55585C3.23279 9.64778 3 10.8181 3 12Z",
    knowledge:
      "M12 5.99996C10.6318 5.21005 9.07983 4.79419 7.5 4.79419C5.92017 4.79419 4.36817 5.21005 3 5.99996V19C4.36817 18.21 5.92017 17.7942 7.5 17.7942C9.07983 17.7942 10.6318 18.2101 12 19M12 5.99996C13.3682 5.21005 14.9202 4.79419 16.5 4.79419C18.0798 4.79419 19.6318 5.21009 21 6V19C19.6318 18.2101 18.0798 17.7942 16.5 17.7942C14.9202 17.7942 13.3682 18.2101 12 19M12 5.99996V19",
  };

  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={d[id as Exclude<NavId, "copilot">] || d.overview}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
