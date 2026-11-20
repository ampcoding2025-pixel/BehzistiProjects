"use client";

import { useLocale } from "@/lib/i18n/locale";

type Props = {
  knowledgeCount?: number;
  skillsCount?: number;
  onManageKnowledge?: () => void;
  onBrowseSkills?: () => void;
  onOpenProfile?: () => void;
};

export function Overview({
  knowledgeCount = 0,
  skillsCount = 4,
  onManageKnowledge,
  onBrowseSkills,
  onOpenProfile,
}: Props) {
  const { t, dir } = useLocale();
  const ov = t.overview;

  const metrics = [
    { title: ov.metricResolution, value: "0%", compare: ov.comparePercent },
    { title: ov.metricChats, value: "0", compare: ov.compareCount },
    { title: ov.metricCsat, value: "0%", compare: ov.comparePercent },
    { title: ov.metricTransferred, value: "0%", compare: ov.comparePercent },
  ];

  return (
    <div className="ov-layout ov-layout--contextual" dir={dir}>
      {/* Agent identity */}
      <div className="ov-section">
        <button
          type="button"
          className="ov-identity"
          aria-label={t.nav.profile}
          onClick={onOpenProfile}
        >
          <div className="ov-avatar ov-avatar--sm ov-avatar--with-status">
            <span className="ov-status ov-status--accept" role="status" data-testid="avatar__status" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={t.nav.aiAgent}
              className="ov-avatar__image"
              src="/behzisti-logo.svg"
            />
          </div>
          <h1 className="ov-identity__name">{t.nav.aiAgent}</h1>
          <span className="ov-identity__edit" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
              <path
                d="M13.5 6.5L17.5 10.5M4 20.0001H8L18.5 9.50006C19.0304 8.96963 19.3284 8.2502 19.3284 7.50006C19.3284 6.74991 19.0304 6.03049 18.5 5.50006C17.9696 4.96963 17.2501 4.67163 16.5 4.67163C15.7499 4.67163 15.0304 4.96963 14.5 5.50006L4 16.0001V20.0001Z"
                stroke="currentcolor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </button>
      </div>

      <div className="ov-section" />

      {/* Setup tiles */}
      <div className="ov-section">
        <div className="ov-tiles">
          <div className="ov-tile">
            <div className="ov-tile__content">
              <div className="ov-tile__copy">
                <div className="ov-tile__title">
                  <span className="ov-tile__title-main">{ov.knowledgeSources}</span>
                  <span className="ov-tile__title-meta">
                    {knowledgeCount} {ov.inUse}
                  </span>
                </div>
                <span className="ov-tile__desc">{ov.knowledgeDesc}</span>
              </div>
              <div className="ov-tile__action">
                <button type="button" className="ov-btn ov-btn--secondary ov-btn--sm" onClick={onManageKnowledge}>
                  <span className="ov-btn__content">{ov.manageKnowledge}</span>
                </button>
              </div>
            </div>
            <div className="ov-tile__image">
              <div className="ov-media" data-testid="media-loader" style={{ aspectRatio: "1280 / 720" }}>
                <video
                  autoPlay
                  loop
                  playsInline
                  muted
                  data-testid="media-loader-video"
                  src="https://cdn.static-text.com/assets/text-app/ai-agents/overview-knowledge.webm"
                />
              </div>
            </div>
          </div>

          <div className="ov-tile">
            <div className="ov-tile__content">
              <div className="ov-tile__copy">
                <div className="ov-tile__title">
                  <span className="ov-tile__title-main">{ov.skills}</span>
                  <span className="ov-tile__title-meta">
                    {skillsCount} {ov.active}
                  </span>
                </div>
                <span className="ov-tile__desc">{ov.skillsDesc}</span>
              </div>
              <div className="ov-tile__action">
                <button type="button" className="ov-btn ov-btn--secondary ov-btn--sm" onClick={onBrowseSkills}>
                  <span className="ov-btn__content">{ov.browseSkills}</span>
                </button>
              </div>
            </div>
            <div className="ov-tile__image">
              <div className="ov-preview">
                <div className="ov-media" data-testid="media-loader" style={{ aspectRatio: "1280 / 720" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={ov.skillsOverviewAlt}
                    loading="eager"
                    src="https://cdn.static-text.com/assets/text-app/ai-agents/overview-skills.png"
                  />
                </div>
                <button type="button" className="ov-play" aria-label={ov.playSkillsOverview}>
                  <span className="ov-play-button">
                    <svg viewBox="0 0 24 25" fill="none" width="24" height="24" aria-hidden="true">
                      <path
                        d="M8.2423 8.00667C8.2423 7.54262 8.74653 7.25423 9.14651 7.48951L16.6359 11.895C17.0302 12.127 17.0302 12.6973 16.6359 12.9293L9.14651 17.3348C8.74653 17.5701 8.2423 17.2817 8.2423 16.8177L8.2423 8.00667Z"
                        fill="currentcolor"
                      />
                    </svg>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Performance data */}
      <div className="ov-section">
        <section className="ov-perf">
          <header className="ov-perf__header">
            <div className="ov-perf__title">
              <h2>{ov.performanceData}</h2>
              <span className="ov-perf__range">{ov.dateRange}</span>
            </div>
            <button type="button" className="ov-btn ov-btn--secondary ov-btn--md">
              <span className="ov-btn__content">{ov.viewFullReport}</span>
            </button>
          </header>
          <div className="ov-perf__metrics">
            {metrics.map((m) => (
              <div key={m.title}>
                <div data-testid="widget-box" className="ov-metric-box">
                  <div className="ov-metric">
                    <div className="ov-metric__title-box">
                      <span className="ov-metric__title">{m.title}</span>
                      <div className="ov-metric__tooltip">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          width="20"
                          height="20"
                          color="var(--content-basic-secondary)"
                          aria-hidden="true"
                        >
                          <path
                            d="M12 8H12.01M11 12H12V16H13M3 12C3 13.1819 3.23279 14.3522 3.68508 15.4442C4.13738 16.5361 4.80031 17.5282 5.63604 18.364C6.47177 19.1997 7.46392 19.8626 8.55585 20.3149C9.64778 20.7672 10.8181 21 12 21C13.1819 21 14.3522 20.7672 15.4442 20.3149C16.5361 19.8626 17.5282 19.1997 18.364 18.364C19.1997 17.5282 19.8626 16.5361 20.3149 15.4442C20.7672 14.3522 21 13.1819 21 12C21 10.8181 20.7672 9.64778 20.3149 8.55585C19.8626 7.46392 19.1997 6.47177 18.364 5.63604C17.5282 4.80031 16.5361 4.13738 15.4442 3.68508C14.3522 3.23279 13.1819 3 12 3C10.8181 3 9.64778 3.23279 8.55585 3.68508C7.46392 4.13738 6.47177 4.80031 5.63604 5.63604C4.80031 6.47177 4.13738 7.46392 3.68508 8.55585C3.23279 9.64778 3 10.8181 3 12Z"
                            stroke="currentcolor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    </div>
                    <div className="ov-metric__details">
                      <div className="ov-metric__value">{m.value}</div>
                      <div className="ov-trend" data-testid="0--trend">
                        <span>–</span>
                      </div>
                    </div>
                    <div className="ov-metric__compare">
                      <span>{m.compare}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="ov-section" />

      {/* Knowledge gaps */}
      <div className="ov-section">
        <section className="ov-gaps">
          <h5>{ov.knowledgeGaps}</h5>
          <div className="ov-gaps-empty ov-gaps-empty--full">
            <div className="ov-gaps-empty__copy">
              <span className="ov-gaps-empty__title">{ov.noGapsTitle}</span>
              <span className="ov-gaps-empty__desc">{ov.noGapsDesc}</span>
            </div>
            <div className="ov-gaps-empty__decor" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="ov-gaps-empty__preview"
                alt={ov.gapsPreviewAlt}
                src="https://cdn.static-text.com/assets/text-app/ai-agents/overview-knowledge-gaps-empty-state.png"
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
