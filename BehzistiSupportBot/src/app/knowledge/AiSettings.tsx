"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n/locale";
import "./ai-settings.css";

type AiProvider = "ollama" | "copilot";
type ProviderStatus = {
  connected: boolean;
  model: string | null;
  models: string[];
  error: string | null;
};

export function AiSettings() {
  const { t, dir } = useLocale();
  const [provider, setProvider] = useState<AiProvider>("ollama");
  const [statuses, setStatuses] = useState<Record<AiProvider, ProviderStatus> | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const settings = t.settingsPage;

  useEffect(() => {
    let active = true;
    void fetch("/api/ai/providers", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load AI providers.");
        if (!active) return;
        if (data.provider === "ollama" || data.provider === "copilot") {
          setProvider(data.provider);
        }
        setStatuses(data.statuses);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Could not load AI providers.");
        }
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function selectProvider(nextProvider: AiProvider) {
    setProvider(nextProvider);
    setChecking(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: nextProvider }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save AI provider.");
      setProvider(data.provider);
      setStatuses(data.statuses);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save AI provider.");
    } finally {
      setChecking(false);
    }
  }

  function statusLabel(status: ProviderStatus | undefined) {
    if (checking) return settings.checking;
    return status?.connected ? settings.connected : settings.disconnected;
  }

  return (
    <div className="ai-settings" dir={dir}>
      <div className="ai-settings__content">
        <header className="ai-settings__header">
          <h1 className="ai-settings__title">{settings.title}</h1>
          <p className="ai-settings__description">{settings.description}</p>
        </header>

        <section className="ai-settings__section" aria-labelledby="ai-provider-heading">
          <div className="ai-settings__section-heading">
            <h2 className="ai-settings__section-title" id="ai-provider-heading">
              {settings.aiProvider}
            </h2>
            <p className="ai-settings__section-description">
              {settings.aiProviderDescription}
            </p>
          </div>

          <fieldset className="ai-settings__providers" aria-label={settings.aiProvider}>
            <label
              className={`ai-settings__provider${provider === "ollama" ? " is-selected" : ""}`}
            >
              <input
                className="ai-settings__radio"
                type="radio"
                name="ai-provider"
                value="ollama"
                checked={provider === "ollama"}
                onChange={() => selectProvider("ollama")}
              />
              <span className="ai-settings__provider-copy">
                <span className="ai-settings__provider-name">{settings.ollama}</span>
                <span className="ai-settings__provider-description">
                  {settings.ollamaDescription}
                </span>
                {statuses?.ollama?.model ? (
                  <span className="ai-settings__provider-detail">
                    {settings.model}: {statuses.ollama.model}
                  </span>
                ) : null}
              </span>
              <span
                className={`ai-settings__provider-status${statuses?.ollama?.connected ? " is-connected" : ""}`}
                role="status"
              >
                {statusLabel(statuses?.ollama)}
              </span>
            </label>

            <label
              className={`ai-settings__provider${provider === "copilot" ? " is-selected" : ""}`}
            >
              <input
                className="ai-settings__radio"
                type="radio"
                name="ai-provider"
                value="copilot"
                checked={provider === "copilot"}
                onChange={() => selectProvider("copilot")}
              />
              <span className="ai-settings__provider-copy">
                <span className="ai-settings__provider-name">{settings.copilot}</span>
                <span className="ai-settings__provider-description">
                  {settings.copilotDescription}
                </span>
                {statuses?.copilot?.models.length ? (
                  <span className="ai-settings__provider-detail">
                    {settings.availableModels}: {statuses.copilot.models.join(", ")}
                  </span>
                ) : null}
              </span>
              <span
                className={`ai-settings__provider-status${statuses?.copilot?.connected ? " is-connected" : ""}`}
                role="status"
              >
                {statusLabel(statuses?.copilot)}
              </span>
            </label>
          </fieldset>

          {statuses?.copilot?.error ? (
            <p className="ai-settings__provider-error" role="status">
              {statuses.copilot.error === "Not authenticated"
                ? settings.copilotNotAuthenticated
                : statuses.copilot.error}
            </p>
          ) : null}

          <p className="ai-settings__notice" role="note">{settings.copilotLoginInstructions}</p>
          <p className="ai-settings__notice" role="note">{settings.providerSelectionNotice}</p>
          {error ? <p className="ai-settings__provider-error" role="alert">{error}</p> : null}
        </section>
      </div>
    </div>
  );
}
