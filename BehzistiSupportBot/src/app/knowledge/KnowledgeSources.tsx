"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "@/lib/i18n/locale";
import { Copilot } from "./Copilot";
import { LaunchGuide } from "./LaunchGuide";
import { Overview } from "./Overview";
import { Playground } from "./Playground";
import { Profile } from "./Profile";
import { Skills } from "./Skills";
import "./knowledge.css";
import "./launch-guide.css";
import "./overview.css";
import "./profile.css";
import "./skills.css";
import "./copilot.css";
import "./playground.css";

type SourceType = "all" | "url" | "file" | "article" | "faq";

type KnowledgeSource = {
  id: string;
  type: Exclude<SourceType, "all">;
  title: string;
  meta: string;
  lastUpdated: string;
  addedBy: string;
  tags?: string[];
};

type OllamaStatus = {
  ready: boolean;
  model: string;
  enabled: boolean;
  error: string | null;
  loading: boolean;
};

type NavId =
  | "launch-guide"
  | "overview"
  | "profile"
  | "skills"
  | "knowledge"
  | "playground"
  | "copilot";

const NAV_IDS: NavId[] = [
  "launch-guide",
  "overview",
  "profile",
  "skills",
  "knowledge",
  "playground",
  "copilot",
];


/** Map internal data/knowledge folder types → LiveChat UI tabs */
function mapSourceType(source: "faq" | "circular" | "law"): Exclude<SourceType, "all"> {
  if (source === "circular") return "file";
  if (source === "law") return "article";
  return "faq";
}

function navFromPath(pathname: string | null): NavId {
  const segment = (pathname ?? "/").replace(/^\//, "").split("/")[0] || "knowledge";
  return (NAV_IDS.includes(segment as NavId) ? segment : "knowledge") as NavId;
}

const PAGE_SIZE = 10;

type SourceCounts = Record<SourceType, number>;

function formatTemplate(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

function uiSourceParam(filter: SourceType): string {
  return filter;
}

/** Build page list with ellipsis, e.g. [1, "…", 4, 5, 6, "…", 12] */
function getPageItems(current: number, total: number): Array<number | "…"> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const items: Array<number | "…"> = [];
  const push = (n: number | "…") => {
    if (items[items.length - 1] !== n) items.push(n);
  };
  push(1);
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) push("…");
  for (let i = start; i <= end; i++) push(i);
  if (end < total - 1) push("…");
  push(total);
  return items;
}

export function KnowledgeSources() {
  const pathname = usePathname();
  const router = useRouter();
  const { t, dir } = useLocale();
  const activeNav = navFromPath(pathname);
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [filter, setFilter] = useState<SourceType>("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [counts, setCounts] = useState<SourceCounts>({
    all: 0,
    url: 0,
    file: 0,
    article: 0,
    faq: 0,
  });
  const [menuOpen, setMenuOpen] = useState<"header" | "empty" | null>(null);
  const [ollama, setOllama] = useState<OllamaStatus>({
    ready: false,
    model: "llama3.2",
    enabled: true,
    error: null,
    loading: true,
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const go = (path: string) => router.push(path);

  const sideNav = useMemo(
    () =>
      [
        { id: "launch-guide" as const, label: t.nav.launchGuide },
        { id: "overview" as const, label: t.nav.overview },
        { id: "profile" as const, label: t.nav.profile },
        { id: "skills" as const, label: t.nav.skills },
        { id: "knowledge" as const, label: t.nav.knowledge, badge: "!" },
        { id: "playground" as const, label: t.nav.playground },
      ] satisfies Array<{ id: NavId; label: string; badge?: string }>,
    [t],
  );

  const filters = useMemo(
    () =>
      [
        { id: "all" as const, label: t.knowledge.all, testId: "knowledge-source-tab-all" },
        {
          id: "url" as const,
          label: t.knowledge.websites,
          testId: "knowledge-source-tab-websites",
          icon: "website" as const,
        },
        {
          id: "file" as const,
          label: t.knowledge.files,
          testId: "knowledge-source-tab-files",
          icon: "file" as const,
        },
        {
          id: "article" as const,
          label: t.knowledge.articles,
          testId: "knowledge-source-tab-articles",
          icon: "article" as const,
        },
        {
          id: "faq" as const,
          label: t.knowledge.faq,
          testId: "knowledge-source-tab-faq",
          icon: "faq" as const,
        },
      ] satisfies Array<{
        id: SourceType;
        label: string;
        testId: string;
        icon?: "website" | "file" | "article" | "faq";
      }>,
    [t],
  );

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setMenuOpen(null);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function loadSources(nextPage = page, nextFilter = filter) {
    setSourcesLoading(true);
    try {
      const params = new URLSearchParams({
        appId: "behzisti-portal",
        page: String(nextPage),
        pageSize: String(PAGE_SIZE),
        source: uiSourceParam(nextFilter),
      });
      const res = await fetch(`/api/knowledge?${params.toString()}`);
      const data = (await res.json()) as {
        page?: number;
        pageSize?: number;
        total?: number;
        totalPages?: number;
        counts?: Partial<SourceCounts>;
        docs?: Array<{
          id: string;
          source: "faq" | "circular" | "law";
          title: string;
          tags?: string[];
          meta?: Record<string, string>;
        }>;
      };
      const docs = (data.docs ?? []).map((d) => {
        const type = mapSourceType(d.source);
        return {
          id: d.id,
          type,
          title: d.title,
          tags: d.tags,
          lastUpdated: d.meta?.date || d.meta?.updatedAt || "",
          addedBy: d.meta?.author || d.meta?.addedBy || "",
          meta:
            d.source === "faq"
              ? d.meta?.category || "Internal FAQ · data/knowledge/faq"
              : d.source === "circular"
                ? [d.meta?.number, d.meta?.date].filter(Boolean).join(" · ") ||
                  "Circular · data/knowledge/circulars"
                : d.meta?.source || "Law · data/knowledge/laws",
        };
      });
      setSources(docs);
      setPage(data.page ?? nextPage);
      setTotal(data.total ?? docs.length);
      setTotalPages(Math.max(1, data.totalPages ?? 1));
      setCounts({
        all: data.counts?.all ?? 0,
        url: data.counts?.url ?? 0,
        file: data.counts?.file ?? 0,
        article: data.counts?.article ?? 0,
        faq: data.counts?.faq ?? 0,
      });
    } catch {
      setSources([]);
      setTotal(0);
      setTotalPages(1);
      setCounts({ all: 0, url: 0, file: 0, article: 0, faq: 0 });
    } finally {
      setSourcesLoading(false);
    }
  }

  async function loadOllamaStatus() {
    setOllama((prev) => ({ ...prev, loading: true }));
    try {
      const res = await fetch("/api/ollama");
      const data = (await res.json()) as {
        ready?: boolean;
        model?: string;
        enabled?: boolean;
        error?: string | null;
      };
      setOllama({
        ready: Boolean(data.ready),
        model: data.model || "llama3.2",
        enabled: data.enabled !== false,
        error: data.error ?? null,
        loading: false,
      });
    } catch {
      setOllama({
        ready: false,
        model: "llama3.2",
        enabled: true,
        error: "Cannot reach Ollama status API",
        loading: false,
      });
    }
  }

  useEffect(() => {
    void loadOllamaStatus();
  }, []);

  useEffect(() => {
    void loadSources(page, filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filter]);

  const countFor = (id: SourceType) => counts[id] ?? 0;

  const rangeFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeTo = Math.min(page * PAGE_SIZE, total);

  const needsSetup =
    (!sourcesLoading && counts.all === 0) || (!ollama.loading && !ollama.ready);

  return (
    <div className="kn-app" ref={rootRef}>
      <div className="kn-app-frame kn-app-frame--no-rail">
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
              <aside className="kn-side-nav" aria-label={t.nav.aiAgent}>
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
                        alt={t.nav.aiAgent}
                        className="kn-side-nav__avatar-img"
                        src="/behzisti-logo.svg"
                      />
                    </div>
                    <div className="kn-side-nav__agent-name">
                      <div data-testid="tooltip-trigger">
                        <div className="kn-text">{t.nav.aiAgent}</div>
                      </div>
                    </div>
                  </div>

                  {sideNav.map((item) => {
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
                        <Link
                          href={`/${item.id}`}
                          className={`kn-side-nav__anchor${isActive ? " is-active" : ""}`}
                          aria-current={isActive ? "page" : undefined}
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
                        </Link>
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
                    data-testid={
                      activeNav === "copilot"
                        ? "side-navigation-active-item-test-id"
                        : "side-navigation-item-test-id"
                    }
                  >
                    <Link
                      href="/copilot"
                      className={`kn-side-nav__anchor${activeNav === "copilot" ? " is-active" : ""}`}
                      aria-current={activeNav === "copilot" ? "page" : undefined}
                    >
                      <span className="kn-side-nav__left-node" data-testid="side-navigation-parent-icon">
                        <NavIcon id="copilot" />
                      </span>
                      <span className={`kn-side-nav__label${activeNav === "copilot" ? " is-active" : ""}`}>
                        <div data-testid="tooltip-trigger">
                          <div className="kn-text">{t.nav.copilot}</div>
                        </div>
                      </span>
                      <span className="kn-side-nav__right-node" />
                    </Link>
                  </div>
                </div>
              </aside>

              <div
                className={`kn-agent-main${
                  activeNav === "launch-guide"
                    ? " kn-agent-main--overview"
                    : activeNav === "overview"
                      ? " kn-agent-main--overview-page"
                      : activeNav === "profile"
                        ? " kn-agent-main--profile-page"
                        : activeNav === "skills"
                          ? " kn-agent-main--skills-page"
                          : activeNav === "knowledge"
                            ? " kn-agent-main--knowledge-page"
                            : activeNav === "playground"
                              ? " kn-agent-main--playground-page"
                              : activeNav === "copilot"
                                ? " kn-agent-main--copilot-page"
                                : ""
                }`}
              >
                {activeNav === "launch-guide" ? (
                  <LaunchGuide
                    onAddWebsite={() => go("/knowledge")}
                    onAddFiles={() => go("/knowledge")}
                    onConnectChannels={() => go("/overview")}
                  />
                ) : activeNav === "overview" ? (
                  <Overview
                    knowledgeCount={sources.length}
                    skillsCount={4}
                    onManageKnowledge={() => go("/knowledge")}
                    onBrowseSkills={() => go("/skills")}
                    onOpenProfile={() => go("/profile")}
                  />
                ) : activeNav === "profile" ? (
                  <Profile />
                ) : activeNav === "skills" ? (
                  <Skills />
                ) : activeNav === "playground" ? (
                  <Playground />
                ) : activeNav === "copilot" ? (
                  <Copilot />
                ) : activeNav === "knowledge" ? (
                  <div className="kn-knowledge-page">
                    <header className="kn-content-header">
                      <h5 className="kn-content-header__title">{t.knowledge.title}</h5>
                      <div className="kn-content-header__right-node">
                        <div className="kn-agent-section-header__actions">
                          <div
                            className={`kn-tag kn-tag--lg${
                              needsSetup ? " kn-tag--warning" : " kn-tag--positive"
                            }`}
                            role="status"
                          >
                            <div className="kn-tag__content-wrapper">
                              <div className="kn-tag__node" data-testid="lc-tag-left-node">
                                <span className="kn-icon">
                                  {needsSetup ? <KnowledgeAlertIcon /> : <KnowledgeCheckIcon />}
                                </span>
                              </div>
                              <div className="kn-tag__content">
                                {needsSetup ? t.knowledge.needsSetup : t.knowledge.ready}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </header>

                    <div className="kn-agent-detail-layout__content">
                      <div className="kn-sources-grid-container">
                        <div className="kn-sources-grid kn-sources-grid--ai-agent kn-sources-grid--contextual">
                          <div className="kn-column kn-column--full-height">
                            <div className="kn-sources-content">
                              <div className="kn-sources-header">
                                <div className="kn-sources-header__navigation">
                                  <fieldset className="kn-segmented kn-segmented--md">
                                    {filters.map((f) => {
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
                                            setPage(1);
                                            setMenuOpen(null);
                                          }}
                                        >
                                          {f.icon ? (
                                            <span
                                              className={`kn-sources-header__tab-icon kn-sources-header__tab-icon--${
                                                f.icon === "faq" ? "qa" : f.icon
                                              }`}
                                            >
                                              <FilterTabIcon kind={f.icon} />
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

                                <div className="kn-sources-header__add-source">
                                  <div
                                    className="kn-action-menu"
                                    data-testid="action-menu-trigger-button"
                                  >
                                    <button
                                      aria-disabled="false"
                                      className="kn-btn kn-btn--primary kn-btn--sm kn-btn--with-left-icon"
                                      type="button"
                                      aria-expanded={menuOpen === "header"}
                                      aria-haspopup="menu"
                                      aria-label="add-source"
                                      onClick={() =>
                                        setMenuOpen((m) => (m === "header" ? null : "header"))
                                      }
                                    >
                                      <span className="kn-btn__icon kn-btn__icon--left kn-icon">
                                        <svg
                                          viewBox="0 0 24 24"
                                          fill="none"
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
                                      <div className="kn-btn__content">{t.knowledge.newSource}</div>
                                    </button>
                                    {menuOpen === "header" ? (
                                      <div className="kn-action-menu__list" role="menu">
                                        <AddSourceItems onClose={() => setMenuOpen(null)} />
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              </div>

                              <div className="kn-sources-content__body">
                                {sourcesLoading ? (
                                  <p className="kn-sources-loading">{t.knowledge.loading}</p>
                                ) : total === 0 ? (
                                  <div className="kn-empty-state kn-empty-state--full kn-empty-state--centered">
                                    <div
                                      className="kn-empty-state__icon--full"
                                      data-testid="icon"
                                    >
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
                                    <h4 className="kn-empty-state__title">
                                      {t.knowledge.emptyTitle}
                                    </h4>
                                    <span className="kn-empty-state__description">
                                      {t.knowledge.emptyDesc}
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
                                          onClick={() =>
                                            setMenuOpen((m) => (m === "empty" ? null : "empty"))
                                          }
                                        >
                                          <div className="kn-btn__content">{t.knowledge.addSource}</div>
                                        </button>
                                        {menuOpen === "empty" ? (
                                          <div
                                            className="kn-action-menu__list kn-action-menu__list--center"
                                            role="menu"
                                          >
                                            <AddSourceItems onClose={() => setMenuOpen(null)} />
                                          </div>
                                        ) : null}
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="kn-overflow-table" dir={dir}>
                                    <div className="kn-table__container">
                                      <div className="kn-table__scroller" data-table-scroller="true">
                                        <table className="kn-table kn-table--large">
                                          <thead>
                                            <tr className="kn-table__header kn-table__header--small">
                                              <th
                                                scope="col"
                                                className="kn-table__th kn-table__th--name"
                                              >
                                                {t.knowledge.colName}
                                              </th>
                                              <th
                                                scope="col"
                                                className="kn-table__th kn-table__th--updated"
                                              >
                                                {t.knowledge.colLastUpdated}
                                              </th>
                                              <th
                                                scope="col"
                                                className="kn-table__th kn-table__th--author"
                                              >
                                                {t.knowledge.colAddedBy}
                                              </th>
                                              <th
                                                scope="col"
                                                className="kn-table__th kn-table__th--actions"
                                              >
                                                {t.knowledge.colActions}
                                              </th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {sources.map((s) => {
                                              const typeLabel =
                                                s.type === "url"
                                                  ? t.knowledge.websites
                                                  : s.type === "file"
                                                    ? t.knowledge.files
                                                    : s.type === "article"
                                                      ? t.knowledge.articles
                                                      : t.knowledge.faq;
                                              return (
                                                <tr key={s.id} className="kn-table__row kn-table__row--interactive">
                                                  <td className="kn-table__td kn-table__td--name">
                                                    <div className="kn-source-name">
                                                      <span
                                                        className="kn-source-name__icon"
                                                        aria-hidden="true"
                                                      >
                                                        <SourceTypeIcon type={s.type} />
                                                      </span>
                                                      <div className="kn-source-name__container">
                                                        <div className="kn-source-name__text">
                                                          {s.title}
                                                        </div>
                                                        <div className="kn-source-name__subtext">
                                                          {typeLabel}
                                                          {s.meta ? ` · ${s.meta}` : ""}
                                                        </div>
                                                      </div>
                                                    </div>
                                                  </td>
                                                  <td className="kn-table__td kn-table__td--updated">
                                                    {s.lastUpdated || t.knowledge.noDate}
                                                  </td>
                                                  <td className="kn-table__td kn-table__td--author">
                                                    <div className="kn-author">
                                                      <div
                                                        className="kn-author__avatar"
                                                        aria-hidden="true"
                                                      >
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img
                                                          alt=""
                                                          className="kn-author__avatar-img"
                                                          src="/behzisti-logo.svg"
                                                        />
                                                      </div>
                                                      <span className="kn-author__text">
                                                        {s.addedBy || t.knowledge.addedBySystem}
                                                      </span>
                                                    </div>
                                                  </td>
                                                  <td className="kn-table__td kn-table__td--actions">
                                                    <div className="kn-action-cell">
                                                      <button
                                                        type="button"
                                                        className="kn-btn kn-btn--secondary kn-btn--sm kn-btn--icon-only"
                                                        aria-label={t.knowledge.viewSource}
                                                      >
                                                        <span className="kn-btn__icon kn-btn__icon--left">
                                                          <svg
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            width="20"
                                                            height="20"
                                                            aria-hidden="true"
                                                          >
                                                            <path
                                                              d="M12 12.5C12.2761 12.5 12.5 12.2761 12.5 12C12.5 11.7239 12.2761 11.5 12 11.5C11.7239 11.5 11.5 11.7239 11.5 12C11.5 12.2761 11.7239 12.5 12 12.5Z"
                                                              stroke="currentcolor"
                                                              strokeWidth="2"
                                                              strokeLinecap="round"
                                                              strokeLinejoin="round"
                                                            />
                                                            <path
                                                              d="M12 6.5C12.2761 6.5 12.5 6.27614 12.5 6C12.5 5.72386 12.2761 5.5 12 5.5C11.7239 5.5 11.5 5.72386 11.5 6C11.5 6.27614 11.7239 6.5 12 6.5Z"
                                                              stroke="currentcolor"
                                                              strokeWidth="2"
                                                              strokeLinecap="round"
                                                              strokeLinejoin="round"
                                                            />
                                                            <path
                                                              d="M12 18.5C12.2761 18.5 12.5 18.2761 12.5 18C12.5 17.7239 12.2761 17.5 12 17.5C11.7239 17.5 11.5 17.7239 11.5 18C11.5 18.2761 11.7239 18.5 12 18.5Z"
                                                              stroke="currentcolor"
                                                              strokeWidth="2"
                                                              strokeLinecap="round"
                                                              strokeLinejoin="round"
                                                            />
                                                          </svg>
                                                        </span>
                                                      </button>
                                                    </div>
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                      <div className="kn-pagination" dir={dir}>
                                        <span className="kn-pagination__range">
                                          {formatTemplate(t.knowledge.rowsPerPage, {
                                            from: rangeFrom,
                                            to: rangeTo,
                                            total,
                                          })}
                                        </span>
                                        <div className="kn-pagination__actions">
                                          <button
                                            type="button"
                                            className="kn-btn kn-btn--secondary kn-btn--sm"
                                            disabled={page <= 1 || sourcesLoading}
                                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                                          >
                                            <span className="kn-btn__content">{t.knowledge.pagePrev}</span>
                                          </button>
                                          <div className="kn-pagination__pages" role="navigation" aria-label={t.knowledge.pageOf.replace("{page}", String(page)).replace("{totalPages}", String(totalPages))}>
                                            {getPageItems(page, totalPages).map((item, idx) =>
                                              item === "…" ? (
                                                <span
                                                  key={`ellipsis-${idx}`}
                                                  className="kn-pagination__ellipsis"
                                                  aria-hidden="true"
                                                >
                                                  …
                                                </span>
                                              ) : (
                                                <button
                                                  key={item}
                                                  type="button"
                                                  className={`kn-pagination__page-btn${
                                                    item === page ? " is-active" : ""
                                                  }`}
                                                  aria-current={item === page ? "page" : undefined}
                                                  disabled={sourcesLoading}
                                                  onClick={() => setPage(item)}
                                                >
                                                  {item}
                                                </button>
                                              ),
                                            )}
                                          </div>
                                          <button
                                            type="button"
                                            className="kn-btn kn-btn--secondary kn-btn--sm"
                                            disabled={page >= totalPages || sourcesLoading}
                                            onClick={() =>
                                              setPage((p) => Math.min(totalPages, p + 1))
                                            }
                                          >
                                            <span className="kn-btn__content">{t.knowledge.pageNext}</span>
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="lg-content">
                    <h1 className="lg-heading">
                      {sideNav.find((n) => n.id === activeNav)?.label ?? activeNav}
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

function SourceTypeIcon({ type }: { type: Exclude<SourceType, "all"> }) {
  if (type === "url") {
    return (
      <svg viewBox="0 0 24 24" fill="none" width="24" height="24" aria-hidden="true">
        <path
          d="M3.6 9H20.4M3.6 15H20.4M11.5 3C9.8155 5.69961 8.92236 8.81787 8.92236 12C8.92236 15.1821 9.8155 18.3004 11.5 21M12.5 3C14.1847 5.69961 15.0778 8.81787 15.0778 12C15.0778 15.1821 14.1847 18.3004 12.5 21M3 12C3 16.9706 7.02944 21 12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12Z"
          stroke="currentcolor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (type === "file") {
    return (
      <svg viewBox="0 0 24 24" fill="none" width="24" height="24" aria-hidden="true">
        <path
          d="M14 3V7C14 7.26522 14.1054 7.51957 14.2929 7.70711C14.4804 7.89464 14.7348 8 15 8H19M14 3H7C6.46957 3 5.96086 3.21071 5.58579 3.58579C5.21071 3.96086 5 4.46957 5 5V19C5 19.5304 5.21071 20.0391 5.58579 20.4142C5.96086 20.7893 6.46957 21 7 21H17C17.5304 21 18.0391 20.7893 18.4142 20.4142C18.7893 20.0391 19 19.5304 19 19V8M14 3L19 8"
          stroke="currentcolor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (type === "article") {
    return (
      <svg viewBox="0 0 24 24" fill="none" width="24" height="24" aria-hidden="true">
        <path
          d="M12 6V19M12 6C10.6318 5.21005 9.07983 4.79419 7.5 4.79419C5.92017 4.79419 4.36817 5.21005 3 5.99996V19C4.36817 18.21 5.92017 17.7942 7.5 17.7942C9.07983 17.7942 10.6318 18.2101 12 19M12 6C13.3682 5.21005 14.9202 4.79419 16.5 4.79419C18.0798 4.79419 19.6318 5.21009 21 6V19C19.6318 18.2101 18.0798 17.7942 16.5 17.7942C14.9202 17.7942 13.3682 18.2101 12 19"
          stroke="currentcolor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" width="24" height="24" aria-hidden="true">
      <path
        d="M8 9H16M8 13H14M10 4H14C15.1046 4 16 4.89543 16 6V20L12 17L8 20V6C8 4.89543 8.89543 4 10 4Z"
        stroke="currentcolor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AddSourceItems({ onClose }: { onClose: () => void }) {
  const { t, dir } = useLocale();
  const items = [
    {
      id: "website" as const,
      label: t.knowledge.addWebsite,
      testId: "website",
    },
    {
      id: "file" as const,
      label: t.knowledge.addFile,
      testId: "update",
    },
    {
      id: "article" as const,
      label: t.knowledge.addArticle,
      testId: "article",
    },
    {
      id: "faq" as const,
      label: t.knowledge.addFaq,
      testId: "question-answer",
    },
  ];

  return (
    <ul className="kn-action-menu__list-inner" role="menu" aria-label={t.knowledge.addSourceMenu} dir={dir}>
      {items.map((item) => (
        <li key={item.id} role="none">
          <button
            type="button"
            className="kn-action-menu__list__item"
            data-testid={item.testId}
            role="menuitem"
            onClick={() => {
              onClose();
            }}
          >
            <div className="kn-list-item">
              <div className="kn-list-item__left-node">
                <FilterTabIcon kind={item.id === "faq" ? "faq" : item.id} />
              </div>
              <div className="kn-list-item__label">
                <span className="kn-list-item__text">{item.label}</span>
              </div>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function KnowledgeAlertIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20" aria-hidden="true">
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

function KnowledgeCheckIcon() {
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

function FilterTabIcon({ kind }: { kind: "website" | "file" | "article" | "faq" }) {
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
          d="M14 3H7C6.46957 3 5.96086 3.21071 5.58579 3.58579C5.21071 3.96086 5 4.46957 5 5V19C5 19.5304 5.21071 20.0391 5.58579 20.4142C5.96086 20.7893 6.46957 21 7 21H17C17.5304 21 18.0391 20.7893 18.4142 20.4142C18.7893 20.0391 19 19.5304 19 19V8M14 3L19 8M14 3V7C14 7.26522 14.1054 7.51957 14.2929 7.70711C14.4804 7.89464 14.7348 8 15 8H19M10.7051 9.67053L9.09879 16.5567L15.2503 15.0873L10.7051 9.67053ZM16.2465 15.1744C16.1984 15.7246 15.7134 16.1316 15.1632 16.0835C14.613 16.0353 14.206 15.5503 14.2542 15.0001C14.3023 14.4499 14.7873 14.0429 15.3375 14.0911C15.8877 14.1392 16.2947 14.6242 16.2465 15.1744ZM11.7011 9.75766C11.653 10.3078 11.168 10.7148 10.6178 10.6667C10.0676 10.6186 9.66061 10.1335 9.70874 9.58335C9.75688 9.03317 10.2419 8.62618 10.7921 8.67431C11.3423 8.72245 11.7493 9.20748 11.7011 9.75766ZM10.0957 16.6439C10.0475 17.1941 9.5625 17.6011 9.01231 17.5529C8.46213 17.5048 8.05514 17.0198 8.10327 16.4696C8.15141 15.9194 8.63644 15.5124 9.18662 15.5605C9.73681 15.6087 10.1438 16.0937 10.0957 16.6439Z"
          stroke="currentcolor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (kind === "article") {
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
  return (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20" aria-hidden="true">
      <path
        d="M14 15V17C14 17.2652 13.8946 17.5196 13.7071 17.7071C13.5196 17.8946 13.2652 18 13 18H6L3 21V11C3 10.7348 3.10536 10.4804 3.29289 10.2929C3.48043 10.1054 3.73478 10 4 10H6M21 14L18 11H11C10.7348 11 10.4804 10.8946 10.2929 10.7071C10.1054 10.5196 10 10.2652 10 10V4C10 3.73478 10.1054 3.48043 10.2929 3.29289C10.4804 3.10536 10.7348 3 11 3H20C20.2652 3 20.5196 3.10536 20.7071 3.29289C20.8946 3.48043 21 3.73478 21 4V14Z"
        stroke="currentcolor"
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

  if (id === "playground") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M6.99985 10.0001H9.99985V7.0001L6.49985 3.5001C7.61948 2.96537 8.87735 2.7909 10.1003 3.00072C11.3232 3.21054 12.4509 3.79432 13.3283 4.67167C14.2056 5.54903 14.7894 6.6768 14.9992 7.8997C15.209 9.1226 15.0346 10.3805 14.4999 11.5001L20.4999 17.5001C20.8977 17.8979 21.1212 18.4375 21.1212 19.0001C21.1212 19.5627 20.8977 20.1023 20.4999 20.5001C20.102 20.8979 19.5625 21.1214 18.9999 21.1214C18.4372 21.1214 17.8977 20.8979 17.4999 20.5001L11.4999 14.5001C10.3802 15.0348 9.12235 15.2093 7.89946 14.9995C6.67656 14.7897 5.54878 14.2059 4.67143 13.3285C3.79407 12.4512 3.21029 11.3234 3.00048 10.1005C2.79066 8.8776 2.96513 7.61973 3.49985 6.5001L6.99985 10.0001Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  const d: Record<Exclude<NavId, "copilot" | "playground">, string> = {
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
        d={d[id as Exclude<NavId, "copilot" | "playground">] || d.overview}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
