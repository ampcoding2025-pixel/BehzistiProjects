"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { Messages } from "@/lib/i18n/messages";
import "./database-sources.css";

type DatabaseSourceMessages = Messages["knowledge"]["databaseSources"];

type DatabaseConnection = {
  id: string;
  name: string;
  endpoint: string;
  host: string;
  enabled: boolean;
  connected: boolean;
  error: string | null;
  syncedAt: string | null;
  syncedCases: number;
};

const DEFAULT_ENDPOINT = "http://localhost:5088";

type FormState = {
  id: string | null;
  name: string;
  endpoint: string;
};

export function DatabaseSources({
  dir,
  messages,
  onConnectionsCount,
}: {
  dir: "ltr" | "rtl";
  messages: DatabaseSourceMessages;
  onConnectionsCount: (count: number) => void;
}) {
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [configuredEndpoint, setConfiguredEndpoint] = useState(DEFAULT_ENDPOINT);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [testing, setTesting] = useState(false);

  async function refreshConnections() {
    setLoading(true);
    try {
      const response = await fetch("/api/database-connections", { cache: "no-store" });
      const data = (await response.json()) as {
        connections?: DatabaseConnection[];
        configuredEndpoint?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || "Could not load connections.");
      const next = data.connections ?? [];
      setConnections(next);
      if (data.configuredEndpoint) setConfiguredEndpoint(data.configuredEndpoint);
      onConnectionsCount(next.length);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load database connections.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshConnections();
  }, []);

  async function sendAction(payload: Record<string, unknown>): Promise<boolean> {
    try {
      const response = await fetch("/api/database-connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Database connection action failed.");
      setError(null);
      await refreshConnections();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Database connection action failed.");
      return false;
    }
  }

  async function testEndpoint(endpoint: string) {
    setTesting(true);
    setNotice(null);
    try {
      const response = await fetch("/api/database-connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", endpoint }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Connection test failed.");
      setError(null);
      setNotice(messages.testSuccess);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Connection test failed.");
    } finally {
      setTesting(false);
    }
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    const saved = await sendAction({
      action: form.id ? "update" : "add",
      ...(form.id ? { id: form.id } : {}),
      name: form.name,
      endpoint: form.endpoint,
    });
    if (saved) {
      setForm(null);
    }
  }

  async function toggleConnection(connection: DatabaseConnection, enabled: boolean) {
    setBusyId(connection.id);
    setNotice(null);
    await sendAction({
      action: "set-enabled",
      id: connection.id,
      enabled,
    });
    setBusyId(null);
  }

  async function syncConnection(connection: DatabaseConnection) {
    setBusyId(connection.id);
    setNotice(null);
    await sendAction({ action: "sync", id: connection.id });
    setBusyId(null);
  }

  async function removeConnection(connection: DatabaseConnection) {
    if (!window.confirm(messages.removeConfirm)) return;
    setBusyId(connection.id);
    await sendAction({ action: "delete", id: connection.id });
    setForm(null);
    setBusyId(null);
  }

  const formatDate = (value: string | null) =>
    value
      ? new Date(value).toLocaleString(dir === "rtl" ? "fa-IR" : "en-US")
      : messages.neverSynced;

  return (
    <section className="kn-db-sources" dir={dir} aria-labelledby="kn-db-sources-title">
      <header className="kn-db-sources__header">
        <div>
          <h2 id="kn-db-sources-title">{messages.title}</h2>
          <p>{messages.description}</p>
        </div>
        {connections.length === 0 ? (
          <button
            type="button"
            className="kn-btn kn-btn--primary kn-btn--sm"
            onClick={() =>
              setForm({ id: null, name: "Dideban (AiTicket API)", endpoint: configuredEndpoint })
            }
          >
            {messages.addConnection}
          </button>
        ) : null}
      </header>

      <p className="kn-db-sources__warning" role="note">{messages.historicalWarning}</p>
      {error ? <p className="kn-db-sources__alert" role="alert">{error}</p> : null}
      {notice ? <p className="kn-db-sources__notice" role="status">{notice}</p> : null}

      {loading ? (
        <p className="kn-db-sources__empty" aria-live="polite">{messages.loading}</p>
      ) : connections.length === 0 ? (
        <div className="kn-db-sources__empty">
          <p>{messages.empty}</p>
        </div>
      ) : (
        <div className="kn-db-sources__list">
          {connections.map((connection) => (
            <article
              className="kn-db-connection"
              key={connection.id}
              aria-busy={busyId === connection.id}
            >
              <div className="kn-db-connection__main">
                <div className="kn-db-connection__title">
                  <h3>{connection.name}</h3>
                  <span
                    className={`kn-db-connection__status${
                      connection.connected ? " is-connected" : ""
                    }`}
                  >
                    {connection.connected ? messages.connected : messages.disconnected}
                  </span>
                  <span
                    className={`kn-db-connection__enabled${
                      connection.enabled ? " is-enabled" : ""
                    }`}
                  >
                    {connection.enabled ? messages.enabled : messages.disabled}
                  </span>
                </div>
                <dl className="kn-db-connection__details">
                  <div>
                    <dt>{messages.host}</dt>
                    <dd>{connection.host}</dd>
                  </div>
                  <div>
                    <dt>{messages.syncedCases}</dt>
                    <dd>{connection.syncedCases.toLocaleString(dir === "rtl" ? "fa-IR" : "en-US")}</dd>
                  </div>
                  <div>
                    <dt>{messages.lastSync}</dt>
                    <dd>{formatDate(connection.syncedAt)}</dd>
                  </div>
                </dl>
                {!connection.connected && connection.error ? (
                  <p className="kn-db-connection__error">{connection.error}</p>
                ) : null}
              </div>

              <div className="kn-db-connection__actions">
                <label className="kn-db-switch">
                  <input
                    type="checkbox"
                    checked={connection.enabled}
                    disabled={busyId === connection.id}
                    aria-label={messages.enable}
                    onChange={(event) => void toggleConnection(connection, event.target.checked)}
                  />
                  <span>{connection.enabled ? messages.enabled : messages.disabled}</span>
                </label>
                <button
                  type="button"
                  className="kn-btn kn-btn--secondary kn-btn--sm"
                  disabled={busyId === connection.id}
                  onClick={() => void syncConnection(connection)}
                >
                  {busyId === connection.id ? messages.syncing : messages.sync}
                </button>
                <button
                  type="button"
                  className="kn-db-connection__settings"
                  aria-label={messages.settings}
                  title={messages.settings}
                  disabled={busyId === connection.id}
                  onClick={() =>
                    setForm({
                      id: connection.id,
                      name: connection.name,
                      endpoint: connection.endpoint,
                    })
                  }
                >
                  <SettingsIcon />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {form ? (
        <div className="kn-db-dialog-backdrop">
          <form
            className="kn-db-dialog"
            dir={dir}
            aria-labelledby="kn-db-dialog-title"
            onSubmit={(event) => void submitForm(event)}
          >
            <h2 id="kn-db-dialog-title">{form.id ? messages.settings : messages.addConnection}</h2>
            <label>
              <span>{messages.name}</span>
              <input
                autoFocus
                required
                maxLength={80}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </label>
            <label>
              <span>{messages.endpoint}</span>
              <input
                required
                type="url"
                readOnly
                placeholder={messages.endpointHint}
                value={form.endpoint}
                onChange={(event) => setForm({ ...form, endpoint: event.target.value })}
              />
              <small>{messages.endpointHint}</small>
            </label>
            <div className="kn-db-dialog__credentials">
              <strong>{messages.credentials}</strong>
              <span>{messages.credentialsHint}</span>
            </div>
            {error ? <p className="kn-db-sources__alert" role="alert">{error}</p> : null}
            {notice ? <p className="kn-db-sources__notice" role="status">{notice}</p> : null}
            <div className="kn-db-dialog__actions">
              {form.id ? (
                <button
                  type="button"
                  className="kn-btn kn-btn--secondary kn-btn--sm"
                  disabled={busyId === form.id}
                  onClick={() => {
                    const connection = connections.find((item) => item.id === form.id);
                    if (connection) void removeConnection(connection);
                  }}
                >
                  {messages.remove}
                </button>
              ) : null}
              <button
                type="button"
                className="kn-btn kn-btn--secondary kn-btn--sm"
                disabled={testing}
                onClick={() => void testEndpoint(form.endpoint)}
              >
                {testing ? messages.testing : messages.test}
              </button>
              <button
                type="button"
                className="kn-btn kn-btn--secondary kn-btn--sm"
                onClick={() => {
                  setForm(null);
                  setError(null);
                  setNotice(null);
                }}
              >
                {messages.cancel}
              </button>
              <button type="submit" className="kn-btn kn-btn--primary kn-btn--sm">
                {messages.save}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="18" height="18" aria-hidden="true">
      <path
        d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm7.3 3.5a7.7 7.7 0 0 0-.1-1.2l1.5-1.2-1.5-2.6-1.8.7a7.3 7.3 0 0 0-2.1-1.2L15 3.6h-3l-.3 1.9a7.3 7.3 0 0 0-2.1 1.2l-1.8-.7-1.5 2.6 1.5 1.2a7.7 7.7 0 0 0 0 2.4l-1.5 1.2 1.5 2.6 1.8-.7a7.3 7.3 0 0 0 2.1 1.2l.3 1.9h3l.3-1.9a7.3 7.3 0 0 0 2.1-1.2l1.8.7 1.5-2.6-1.5-1.2c.1-.4.1-.8.1-1.2Z"
        fill="currentColor"
      />
    </svg>
  );
}
