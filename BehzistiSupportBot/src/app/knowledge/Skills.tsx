"use client";

import { useMemo, useState } from "react";
import { useLocale } from "@/lib/i18n/locale";

type SkillIconKind = "wave" | "id" | "ticket" | "transfer" | "discount" | "shopify" | "cart";

type SkillDef = {
  id: string;
  title: string;
  description: string;
  enabled?: boolean;
  setupRequired?: boolean;
  icon: SkillIconKind;
};

export function Skills() {
  const { t, dir } = useLocale();
  const sk = t.skillsPage;

  const skills = useMemo<SkillDef[]>(
    () => [
      {
        id: "welcome",
        title: sk.welcomeTitle,
        description: sk.welcomeDesc,
        enabled: true,
        icon: "wave",
      },
      {
        id: "collect",
        title: sk.collectTitle,
        description: sk.collectDesc,
        enabled: true,
        icon: "id",
      },
      {
        id: "tickets",
        title: sk.ticketsTitle,
        description: sk.ticketsDesc,
        enabled: true,
        icon: "ticket",
      },
      {
        id: "transfer",
        title: sk.transferTitle,
        description: sk.transferDesc,
        enabled: true,
        icon: "transfer",
      },
      {
        id: "discount",
        title: sk.discountTitle,
        description: sk.discountDesc,
        setupRequired: true,
        icon: "discount",
      },
      {
        id: "order",
        title: sk.orderTitle,
        description: sk.orderDesc,
        setupRequired: true,
        icon: "shopify",
      },
      {
        id: "recommend",
        title: sk.recommendTitle,
        description: sk.recommendDesc,
        setupRequired: true,
        icon: "cart",
      },
    ],
    [sk],
  );

  const [enabled, setEnabled] = useState<Record<string, boolean>>(() => ({
    welcome: true,
    collect: true,
    tickets: true,
    transfer: true,
  }));

  return (
    <div className="sk-settings" dir={dir}>
      <div className="sk-settings__wrapper sk-settings__wrapper--contextual">
        <div className="sk-page">
          {/* Custom skills */}
          <section className="sk-section">
            <div className="sk-section__title-row">
              <h5 className="sk-section__title">{sk.customSkills}</h5>
            </div>
            <div className="sk-grid">
              <button type="button" className="sk-create" aria-disabled="false">
                <div className="sk-create__body">
                  <div className="sk-create__top">
                    <div className="sk-create__icon-wrap">
                      <span className="sk-create__icon">
                        <svg viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
                          <path
                            d="M5 12H19M12 5V19"
                            stroke="currentcolor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    </div>
                  </div>
                  <div className="sk-create__content">
                    <span className="sk-create__title">{sk.createSkill}</span>
                    <span className="sk-create__desc">{sk.createSkillDesc}</span>
                  </div>
                </div>
              </button>
            </div>
          </section>

          {/* Default skills */}
          <section className="sk-section">
            <h5 className="sk-section__title">{sk.defaultSkills}</h5>
            <div className="sk-grid">
              {skills.map((skill) => (
                <div key={skill.id} className="sk-item">
                  <div
                    data-testid="skill-card"
                    className="sk-card sk-card--clickable"
                    role="button"
                    tabIndex={0}
                  >
                    <div className="sk-card__body">
                      <div className="sk-card__top">
                        <div className="sk-card__icon-wrap">
                          <SkillIcon kind={skill.icon} />
                        </div>
                        <div className="sk-card__actions">
                          {skill.setupRequired ? (
                            <button
                              type="button"
                              className="sk-card__setup"
                              aria-label={sk.setupRequired}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="sk-card__setup-badge">
                                <svg
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  width="16"
                                  height="16"
                                  aria-hidden="true"
                                >
                                  <path
                                    d="M6.99985 10.0001H9.99985V7.0001L6.49985 3.5001C7.61948 2.96537 8.87735 2.7909 10.1003 3.00072C11.3232 3.21054 12.4509 3.79432 13.3283 4.67167C14.2056 5.54903 14.7894 6.6768 14.9992 7.8997C15.209 9.1226 15.0346 10.3805 14.4999 11.5001L20.4999 17.5001C20.8977 17.8979 21.1212 18.4375 21.1212 19.0001C21.1212 19.5627 20.8977 20.1023 20.4999 20.5001C20.102 20.8979 19.5625 21.1214 18.9999 21.1214C18.4372 21.1214 17.8977 20.8979 17.4999 20.5001L11.4999 14.5001C10.3802 15.0348 9.12235 15.2093 7.89946 14.9995C6.67656 14.7897 5.54878 14.2059 4.67143 13.3285C3.79407 12.4512 3.21029 11.3234 3.00048 10.1005C2.79066 8.8776 2.96513 7.61973 3.49985 6.5001L6.99985 10.0001Z"
                                    stroke="currentcolor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </span>
                            </button>
                          ) : (
                            <span className="sk-switch sk-switch--medium">
                              <input
                                aria-label={sk.enableSkill}
                                className="sk-switch__input"
                                type="checkbox"
                                checked={!!enabled[skill.id]}
                                name="switch"
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) =>
                                  setEnabled((prev) => ({
                                    ...prev,
                                    [skill.id]: e.target.checked,
                                  }))
                                }
                              />
                              <span className="sk-switch__container">
                                <span
                                  className={`sk-switch__track${
                                    enabled[skill.id] ? " sk-switch__track--on" : ""
                                  }`}
                                />
                                <span
                                  className={`sk-switch__slider sk-switch__slider--medium${
                                    enabled[skill.id] ? " sk-switch__slider--on" : ""
                                  }`}
                                />
                              </span>
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="sk-card__content">
                        <div className="sk-card__title-row" data-testid="skill-card-title-row">
                          <span className="sk-card__title" title={skill.title}>
                            {skill.title}
                          </span>
                        </div>
                        <span className="sk-card__desc" title={skill.description}>
                          {skill.description}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function SkillIcon({ kind }: { kind: SkillIconKind }) {
  if (kind === "wave") {
    return (
      <span className="sk-card__icon">
        <svg viewBox="0 0 24 24" fill="none" width="20" height="20" aria-hidden="true">
          <path
            d="M18.5479 9.72246C18.7468 9.37793 19.0744 9.12653 19.4587 9.02357C19.843 8.9206 20.2524 8.97451 20.5969 9.17342C20.9415 9.37233 21.1929 9.69996 21.2958 10.0842C21.3988 10.4685 21.3449 10.8779 21.146 11.2225L16.896 18.5837C16.1003 19.9618 14.7898 20.9674 13.2527 21.3792C11.7157 21.7911 10.0779 21.5755 8.69982 20.7798L6.96777 19.7798L7.1479 19.8838C6.28728 19.3871 5.56349 18.6845 5.04152 17.839C4.51955 16.9934 4.21574 16.0315 4.15739 15.0396C4.1505 14.9203 4.14392 14.801 4.13764 14.6817C4.10694 14.1109 4.11315 11.9102 4.15588 8.07816C4.16023 7.68753 4.3168 7.314 4.5923 7.03703C4.86779 6.76006 5.24047 6.60149 5.63107 6.59505C6.04721 6.58805 6.45375 6.72028 6.78613 6.97076C7.11851 7.22124 7.35766 7.57559 7.46561 7.97754L8.00367 9.9856L11.7539 3.49049C11.9529 3.14596 12.2805 2.89457 12.6648 2.7916C13.049 2.68864 13.4585 2.74254 13.803 2.94145C14.1475 3.14036 14.3989 3.46799 14.5019 3.85226C14.6048 4.23653 14.551 4.64608 14.3521 4.99061M14.3521 4.99061L15.3521 3.25856C15.4506 3.08796 15.5817 2.93844 15.738 2.81853C15.8943 2.69861 16.0726 2.61065 16.2629 2.55967C16.4532 2.50868 16.6516 2.49568 16.8469 2.52139C17.0422 2.5471 17.2305 2.61103 17.4011 2.70952C17.5717 2.80801 17.7212 2.93914 17.8412 3.09541C17.9611 3.25169 18.049 3.43006 18.1 3.62033C18.151 3.8106 18.164 4.00905 18.1383 4.20435C18.1126 4.39964 18.0487 4.58796 17.9502 4.75856L13.7002 12.1198M14.3521 4.99061L11.3813 9.98568M16.9502 6.49049C17.1491 6.14596 17.4768 5.89457 17.861 5.7916C18.2453 5.68864 18.6547 5.74254 18.9993 5.94145C19.3438 6.14036 19.5952 6.46799 19.6982 6.85226C19.8011 7.23653 19.7472 7.64596 19.5483 7.99049L16.2983 13.6197"
            stroke="currentcolor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }

  if (kind === "id") {
    return (
      <span className="sk-card__icon">
        <svg viewBox="0 0 24 24" fill="none" width="20" height="20" aria-hidden="true">
          <path
            d="M3 4m0 3a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v10a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M9 10m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path d="M15 8l2 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M15 12l2 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M7 16l10 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
    );
  }

  if (kind === "ticket") {
    return (
      <span className="sk-card__icon">
        <svg viewBox="0 0 24 24" fill="none" width="20" height="20" aria-hidden="true">
          <path
            d="M15 5V7M15 11V13M15 17V19M5 5H19C19.5304 5 20.0391 5.21071 20.4142 5.58579C20.7893 5.96086 21 6.46957 21 7V10C20.4696 10 19.9609 10.2107 19.5858 10.5858C19.2107 10.9609 19 11.4696 19 12C19 12.5304 19.2107 13.0391 19.5858 13.4142C19.9609 13.7893 20.4696 14 21 14V17C21 17.5304 20.7893 18.0391 20.4142 18.4142C20.0391 18.7893 19.5304 19 19 19H5C4.46957 19 3.96086 18.7893 3.58579 18.4142C3.21071 18.0391 3 17.5304 3 17V14C3.53043 14 4.03914 13.7893 4.41421 13.4142C4.78929 13.0391 5 12.5304 5 12C5 11.4696 4.78929 10.9609 4.41421 10.5858C4.03914 10.2107 3.53043 10 3 10V7C3 6.46957 3.21071 5.96086 3.58579 5.58579C3.96086 5.21071 4.46957 5 5 5Z"
            stroke="currentcolor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }

  if (kind === "transfer") {
    return (
      <span className="sk-card__icon">
        <svg viewBox="0 0 24 24" fill="none" width="20" height="20" aria-hidden="true">
          <path
            d="m4 14h16l-5.5 6m5.5-10h-16l5.5-6"
            stroke="currentcolor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </svg>
      </span>
    );
  }

  if (kind === "discount") {
    return (
      <span className="sk-card__icon">
        <svg viewBox="0 0 24 24" fill="none" width="20" height="20" aria-hidden="true">
          <path
            d="m9 15 6-6m-5 .5c0 .27614-.22386.5-.5.5s-.5-.22386-.5-.5.22386-.5.5-.5.5.22386.5.5zm-5-2.30003c0-.58347.23179-1.14305.64437-1.55563s.97216-.64437 1.55563-.64437h1c.5809-.00033 1.13809-.2304 1.55-.64l.7-.7c.2045-.2056.4475-.36876.7152-.48009.2678-.11133.5549-.16865.8448-.16865.29 0 .577.05732.8448.16865.2677.11133.5108.27449.7152.48009l.7.7c.4119.4096.9691.63967 1.55.64h1c.5835 0 1.1431.23179 1.5556.64437.4126.41258.6444.97216.6444 1.55563v1c.0003.5809.2304 1.13809.64 1.55l.7.70003c.2056.2044.3688.4475.4801.7152s.1686.5548.1686.8448c0 .2899-.0573.577-.1686.8447-.1113.2678-.2745.5108-.4801.7153l-.7.7c-.4096.4119-.6397.9691-.64 1.55v1c0 .5834-.2318 1.143-.6444 1.5556-.4125.4126-.9721.6444-1.5556.6444h-1c-.5809.0003-1.1381.2304-1.55.64l-.7.7c-.2044.2056-.4475.3687-.7152.4801-.2678.1113-.5548.1686-.8448.1686-.2899 0-.577-.0573-.8448-.1686-.2677-.1114-.5107-.2745-.7152-.4801l-.7-.7c-.41191-.4096-.9691-.6397-1.55-.64h-1c-.58347 0-1.14305-.2318-1.55563-.6444s-.64437-.9722-.64437-1.5556v-1c-.00033-.5809-.23039-1.1381-.64-1.55l-.7-.7c-.2056-.2045-.36875-.4475-.48009-.7153-.11133-.2677-.16865-.5548-.16865-.8447 0-.29.05732-.5771.16865-.8448.11134-.2677.27449-.5108.48009-.7152l.7-.70003c.40961-.41191.63967-.9691.64-1.55zm10 7.30003c0 .2761-.2239.5-.5.5s-.5-.2239-.5-.5.2239-.5.5-.5.5.2239.5.5z"
            stroke="currentcolor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </svg>
      </span>
    );
  }

  if (kind === "shopify") {
    return (
      <span className="sk-card__icon sk-card__icon--shopify">
        <svg viewBox="0 0 24 25" fill="none" width="16" height="16" aria-hidden="true">
          <path
            d="M18.0818 6.77835C18.068 6.67835 17.9804 6.62301 17.908 6.61691C17.8358 6.61088 16.3064 6.49753 16.3064 6.49753C16.3064 6.49753 15.2443 5.44307 15.1277 5.32636C15.0111 5.20972 14.7833 5.24519 14.6948 5.27122C14.6818 5.27506 14.4628 5.34266 14.1005 5.45478C13.7457 4.43382 13.1195 3.4956 12.0179 3.4956C11.9875 3.4956 11.9562 3.49683 11.9249 3.49861C11.6116 3.0843 11.2235 2.9043 10.8883 2.9043C8.32221 2.9043 7.09625 6.11218 6.71186 7.74233C5.71474 8.0513 5.00638 8.27096 4.9159 8.29938C4.35932 8.47397 4.34172 8.49151 4.26863 9.01596C4.21363 9.41302 2.75732 20.6753 2.75732 20.6753L14.1052 22.8015L20.2538 21.4713C20.2538 21.4713 18.0954 6.87835 18.0818 6.77835H18.0818ZM13.4733 5.64876L12.5131 5.94595C12.5134 5.87828 12.5137 5.8117 12.5137 5.7389C12.5137 5.10437 12.4257 4.59348 12.2844 4.18848C12.852 4.25971 13.23 4.90554 13.4733 5.64876ZM11.5802 4.3143C11.7381 4.70971 11.8407 5.27718 11.8407 6.04294C11.8407 6.08212 11.8403 6.11794 11.84 6.15417C11.2155 6.3476 10.5369 6.5576 9.85688 6.76828C10.2387 5.29458 10.9545 4.5828 11.5802 4.3143V4.3143ZM10.8178 3.59259C10.9286 3.59259 11.0402 3.63019 11.147 3.70368C10.3246 4.09067 9.44304 5.06533 9.07078 7.01171L7.50324 7.49719C7.93927 6.01259 8.97461 3.59259 10.8178 3.59259H10.8178Z"
            fill="#95BF46"
          />
          <path
            d="M17.9077 6.61729C17.8354 6.61126 16.3061 6.49791 16.3061 6.49791C16.3061 6.49791 15.244 5.44345 15.1274 5.32674C15.0838 5.28331 15.025 5.26105 14.9635 5.25146L14.1055 22.8017L20.2535 21.4717C20.2535 21.4717 18.095 6.87873 18.0815 6.77873C18.0677 6.67873 17.9801 6.62339 17.9077 6.61729"
            fill="#5E8E3E"
          />
          <path
            d="M12.0177 10.0144L11.2596 12.2696C11.2596 12.2696 10.5953 11.9151 9.78107 11.9151C8.58736 11.9151 8.5273 12.6642 8.5273 12.853C8.5273 13.883 11.2122 14.2776 11.2122 16.6902C11.2122 18.5884 10.0083 19.8106 8.38504 19.8106C6.43708 19.8106 5.44092 18.5983 5.44092 18.5983L5.96249 16.875C5.96249 16.875 6.98647 17.7541 7.85051 17.7541C8.4151 17.7541 8.64476 17.3096 8.64476 16.9848C8.64476 15.6412 6.44202 15.5813 6.44202 13.3736C6.44202 11.5154 7.77572 9.71729 10.4679 9.71729C11.5052 9.71729 12.0177 10.0144 12.0177 10.0144"
            fill="white"
          />
        </svg>
      </span>
    );
  }

  return (
    <span className="sk-card__icon">
      <svg viewBox="0 0 24 24" fill="none" width="20" height="20" aria-hidden="true">
        <path
          d="M6 5L20 6L19 13H6M6 17C6.53043 17 7.03914 17.2107 7.41421 17.5858C7.78929 17.9609 8 18.4696 8 19C8 19.5304 7.78929 20.0391 7.41421 20.4142C7.03914 20.7893 6.53043 21 6 21C5.46957 21 4.96086 20.7893 4.58579 20.4142C4.21071 20.0391 4 19.5304 4 19C4 18.4696 4.21071 17.9609 4.58579 17.5858C4.96086 17.2107 5.46957 17 6 17ZM6 17H17M6 17V3H4M17 17C17.5304 17 18.0391 17.2107 18.4142 17.5858C18.7893 17.9609 19 18.4696 19 19C19 19.5304 18.7893 20.0391 18.4142 20.4142C18.0391 20.7893 17.5304 21 17 21C16.4696 21 15.9609 20.7893 15.5858 20.4142C15.2107 20.0391 15 19.5304 15 19C15 18.4696 15.2107 17.9609 15.5858 17.5858C15.9609 17.2107 16.4696 17 17 17Z"
          stroke="currentcolor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
