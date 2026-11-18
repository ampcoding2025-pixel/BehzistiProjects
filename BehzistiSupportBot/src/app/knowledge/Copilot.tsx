"use client";

import { useMemo, useState } from "react";

type CopilotSourceType = "all" | "url" | "file" | "article";

type CopilotSource = {
  id: string;
  type: Exclude<CopilotSourceType, "all">;
  title: string;
  meta: string;
};

const SLIDES = [
  {
    title: "Your internal AI assistant",
    description:
      "Find answers, manage conversations, and track performance. Copilot supports your team, not customers directly.",
    image:
      "https://cdn.static-text.com/assets/text-app/copilot/intro-banner/internal-assistant--light.webp",
  },
  {
    title: "Answers grounded in your knowledge",
    description:
      "Add websites, articles, and files so Copilot can suggest accurate replies based on your content.",
    image:
      "https://cdn.static-text.com/assets/text-app/copilot/intro-banner/internal-assistant--light.webp",
  },
  {
    title: "Help agents move faster",
    description:
      "Copilot drafts replies, summarizes chats, and surfaces the right next step while your team stays in control.",
    image:
      "https://cdn.static-text.com/assets/text-app/copilot/intro-banner/internal-assistant--light.webp",
  },
  {
    title: "Keep quality consistent",
    description:
      "Share approved guidance with every teammate so answers stay on-brand and aligned with your policies.",
    image:
      "https://cdn.static-text.com/assets/text-app/copilot/intro-banner/internal-assistant--light.webp",
  },
  {
    title: "Track what works",
    description:
      "See how Copilot supports your team and refine knowledge sources to improve suggestions over time.",
    image:
      "https://cdn.static-text.com/assets/text-app/copilot/intro-banner/internal-assistant--light.webp",
  },
] as const;

const FILTERS: Array<{
  id: CopilotSourceType;
  label: string;
  testId: string;
  icon?: "website" | "file" | "article";
}> = [
  { id: "all", label: "All", testId: "knowledge-source-tab-all" },
  { id: "url", label: "Websites", testId: "knowledge-source-tab-websites", icon: "website" },
  { id: "file", label: "Files", testId: "knowledge-source-tab-files", icon: "file" },
  { id: "article", label: "Articles", testId: "knowledge-source-tab-articles", icon: "article" },
];

export function Copilot() {
  const [slide, setSlide] = useState(0);
  const [filter, setFilter] = useState<CopilotSourceType>("all");
  const [menuOpen, setMenuOpen] = useState<"header" | "empty" | null>(null);
  const [sources, setSources] = useState<CopilotSource[]>([]);

  const filtered = useMemo(
    () => (filter === "all" ? sources : sources.filter((s) => s.type === filter)),
    [sources, filter],
  );

  const countFor = (id: CopilotSourceType) =>
    id === "all" ? sources.length : sources.filter((s) => s.type === id).length;

  const current = SLIDES[slide];

  function addSource(type: Exclude<CopilotSourceType, "all">) {
    const titles: Record<Exclude<CopilotSourceType, "all">, string> = {
      url: "Website source",
      file: "Uploaded document",
      article: "Help article",
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

  function goPrev() {
    setSlide((s) => (s - 1 + SLIDES.length) % SLIDES.length);
  }

  function goNext() {
    setSlide((s) => (s + 1) % SLIDES.length);
  }

  return (
    <div className="cp-page">
      <div className="cp-grid-container">
        <div className="cp-grid">
          <div className="cp-column">
            {/* Intro banner carousel */}
            <section
              className="cp-banner"
              aria-roledescription="carousel"
              aria-label="Meet Copilot"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="cp-banner__image" alt="" src={current.image} />
              <div className="cp-banner__content">
                <div className="cp-banner__text" aria-live="polite">
                  <p className="cp-banner__caption">
                    <span className="cp-banner__caption-label">Meet Copilot</span>
                    {" · "}
                    {slide + 1}/{SLIDES.length}
                  </p>
                  <h2 className="cp-banner__title">{current.title}</h2>
                  <span className="cp-banner__desc">{current.description}</span>
                </div>
                <div className="cp-banner__controls">
                  <div className="cp-banner__arrows">
                    <button
                      type="button"
                      className="cp-btn cp-btn--float cp-btn--xs cp-btn--icon"
                      aria-label="Previous"
                      onClick={goPrev}
                    >
                      <svg viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
                        <path
                          d="M15 6L9 12L15 18"
                          stroke="currentcolor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="cp-btn cp-btn--float cp-btn--xs cp-btn--icon"
                      aria-label="Next"
                      onClick={goNext}
                    >
                      <svg viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
                        <path
                          d="M9 6L15 12L9 18"
                          stroke="currentcolor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                  <div className="cp-banner__indicators" aria-hidden="true">
                    {SLIDES.map((_, i) => (
                      <span
                        key={i}
                        className={`cp-banner__indicator${i === slide ? " is-active" : ""}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Sources */}
            <div className="cp-sources">
              <div className="cp-sources__header">
                <div className="cp-sources__nav">
                  <fieldset className="kn-segmented kn-segmented--md">
                    {FILTERS.map((f) => {
                      const active = filter === f.id;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          data-testid={f.testId}
                          aria-pressed={active}
                          className={`kn-segmented__btn${active ? " is-active" : ""}${
                            f.icon ? " kn-segmented__btn--icon" : ""
                          }`}
                          onClick={() => {
                            setFilter(f.id);
                            setMenuOpen(null);
                          }}
                        >
                          {f.icon ? (
                            <span
                              className={`kn-sources-header__tab-icon kn-sources-header__tab-icon--${f.icon}`}
                            >
                              <TabIcon kind={f.icon} />
                            </span>
                          ) : null}
                          <span className="kn-segmented__label">
                            {f.label} ({countFor(f.id)})
                          </span>
                        </button>
                      );
                    })}
                  </fieldset>
                </div>

                <div className="cp-sources__add">
                  <div className="kn-action-menu">
                    <button
                      type="button"
                      className="kn-btn kn-btn--primary kn-btn--sm kn-btn--with-left-icon"
                      aria-expanded={menuOpen === "header"}
                      aria-haspopup="menu"
                      aria-label="add-source"
                      onClick={() => setMenuOpen((m) => (m === "header" ? null : "header"))}
                    >
                      <span className="kn-btn__icon kn-btn__icon--left kn-icon">
                        <svg viewBox="0 0 24 24" fill="none" width="20" height="20" aria-hidden="true">
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
                    {menuOpen === "header" ? (
                      <div className="kn-action-menu__list" role="menu">
                        <AddItems onPick={addSource} />
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="cp-sources__body">
                {filtered.length === 0 ? (
                  <div className="kn-empty-state kn-empty-state--full kn-empty-state--centered">
                    <div className="kn-empty-state__icon--full" data-testid="icon">
                      <span className="kn-icon">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
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
                    <h4 className="kn-empty-state__title">Power up Copilot with knowledge</h4>
                    <span className="kn-empty-state__description">
                      Help Copilot suggest better replies and support your team.
                      <br />
                      Add websites, articles, or files.
                    </span>
                    <div className="kn-empty-state__actions">
                      <div className="kn-action-menu">
                        <button
                          type="button"
                          className="kn-btn kn-btn--primary kn-btn--sm kn-btn--with-left-icon"
                          aria-expanded={menuOpen === "empty"}
                          aria-haspopup="menu"
                          aria-label="add-source"
                          onClick={() => setMenuOpen((m) => (m === "empty" ? null : "empty"))}
                        >
                          <span className="kn-btn__icon kn-btn__icon--left kn-icon">
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              width="20"
                              height="20"
                              aria-hidden="true"
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
                        {menuOpen === "empty" ? (
                          <div
                            className="kn-action-menu__list kn-action-menu__list--center"
                            role="menu"
                          >
                            <AddItems onPick={addSource} />
                          </div>
                        ) : null}
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
  );
}

function AddItems({
  onPick,
}: {
  onPick: (type: Exclude<CopilotSourceType, "all">) => void;
}) {
  return (
    <>
      <button
        type="button"
        className="kn-action-menu__item"
        role="menuitem"
        onClick={() => onPick("url")}
      >
        Website URL
        <span className="kn-action-menu__hint">Public or internal docs page</span>
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
        onClick={() => onPick("article")}
      >
        Article
        <span className="kn-action-menu__hint">Help Center / knowledge article</span>
      </button>
    </>
  );
}

function TabIcon({ kind }: { kind: "website" | "file" | "article" }) {
  if (kind === "website") {
    return (
      <svg viewBox="0 0 24 24" fill="none" width="20" height="20" aria-hidden="true">
        <path
          d="M3.6001 9H20.4001M3.6001 15H20.4001M11.5002 3C9.8155 5.69961 8.92236 8.81787 8.92236 12C8.92236 15.1821 9.8155 18.3004 11.5002 21M12.5 3C14.1847 5.69961 15.0778 8.81787 15.0778 12C15.0778 15.1821 14.1847 18.3004 12.5 21M3 12C3 13.1819 3.23279 14.3522 3.68508 15.4442C4.13738 16.5361 4.80031 17.5282 5.63604 18.364C6.47177 19.1997 7.46392 19.8626 8.55585 20.3149C9.64778 20.7672 10.8181 21 12 21C13.1819 21 14.3522 20.7672 15.4442 20.3149C16.5361 19.8626 17.5282 19.1997 18.364 18.364C19.1997 17.5282 19.8626 16.5361 20.3149 15.4442C20.7672 14.3522 21 13.1819 21 12C21 10.8181 20.7672 9.64778 20.3149 8.55585C19.8626 7.46392 19.1997 6.47177 18.364 5.63604C17.5282 4.80031 16.5361 4.13738 15.4442 3.68508C14.3522 3.23279 13.1819 3 12 3C10.8181 3 9.64778 3.23279 8.55585 3.68508C7.46392 4.13738 6.47177 4.80031 5.63604 5.63604C4.80031 6.47177 4.13738 7.46392 3.68508 8.55585C3.23279 9.64778 3 10.8181 3 12Z"
          stroke="currentcolor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (kind === "file") {
    return (
      <svg viewBox="0 0 24 24" fill="none" width="20" height="20" aria-hidden="true">
        <path
          d="M14 3H7C6.46957 3 5.96086 3.21071 5.58579 3.58579C5.21071 3.96086 5 4.46957 5 5V19C5 19.5304 5.21071 20.0391 5.58579 20.4142C5.96086 20.7893 6.46957 21 7 21H17C17.5304 21 18.0391 20.7893 18.4142 20.4142C18.7893 20.0391 19 19.5304 19 19V8M14 3L19 8M14 3V7C14 7.26522 14.1054 7.51957 14.2929 7.70711C14.4804 7.89464 14.7348 8 15 8H19"
          stroke="currentcolor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20" aria-hidden="true">
      <path
        d="M12 19H8M10 5V19M4 7V5H16V7M15 13V12H21V13M18 12V19M17 19H19"
        stroke="currentcolor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
