"use client";

import { useCallback, useEffect, useState } from "react";
import type { ChatSession } from "@/lib/types";

export function AgentConsole() {
  const [queue, setQueue] = useState<ChatSession[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<ChatSession | null>(null);
  const [agentName, setAgentName] = useState("کارشناس پاسخگو");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/handoff");
    const data = await res.json();
    setQueue(data.sessions ?? []);
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 2500);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    if (!selectedId) {
      setSelected(null);
      return;
    }
    const load = async () => {
      const res = await fetch(`/api/chat?sessionId=${selectedId}`);
      if (res.ok) setSelected(await res.json());
    };
    void load();
    const t = setInterval(() => void load(), 2000);
    return () => clearInterval(t);
  }, [selectedId]);

  async function claim() {
    if (!selectedId) return;
    setBusy(true);
    try {
      const res = await fetch("/api/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "claim",
          sessionId: selectedId,
          agentName,
          agentId: "agent-demo",
        }),
      });
      setSelected(await res.json());
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function sendReply() {
    if (!selectedId || !reply.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reply",
          sessionId: selectedId,
          message: reply.trim(),
        }),
      });
      setSelected(await res.json());
      setReply("");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function closeSession() {
    if (!selectedId) return;
    setBusy(true);
    try {
      const res = await fetch("/api/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close", sessionId: selectedId }),
      });
      setSelected(await res.json());
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="agent-layout">
      <aside className="queue">
        <h3>صف ارجاع زنده ({queue.length})</h3>
        <ul className="queue-list">
          {queue.length === 0 && (
            <li style={{ padding: "0.85rem", color: "var(--muted)" }}>فعلاً موردی در صف نیست.</li>
          )}
          {queue.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className={selectedId === s.id ? "active" : ""}
                onClick={() => setSelectedId(s.id)}
              >
                {s.userLabel || "کاربر"}
                <small>
                  {s.status === "waiting_agent" ? "در انتظار" : "در حال گفتگو"} ·{" "}
                  {new Date(s.updatedAt).toLocaleTimeString("fa-IR")}
                </small>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="agent-chat">
        <div className="head" style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <strong style={{ flex: 1 }}>گفتگوی انتخاب‌شده</strong>
          <input
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            aria-label="نام کارشناس"
            style={{
              border: "1px solid var(--line)",
              borderRadius: 10,
              padding: "0.35rem 0.6rem",
              minWidth: 140,
            }}
          />
          <button className="btn secondary" type="button" disabled={!selectedId || busy} onClick={claim}>
            پذیرش گفتگو
          </button>
          <button className="btn warn" type="button" disabled={!selectedId || busy} onClick={closeSession}>
            بستن
          </button>
        </div>

        {!selected ? (
          <div style={{ padding: "1.25rem", color: "var(--muted)" }}>یک گفتگو از صف انتخاب کنید.</div>
        ) : (
          <>
            <div className="messages" style={{ minHeight: 360 }}>
              {selected.messages.map((m) => (
                <div key={m.id} className={`bubble ${m.role}`}>
                  {m.content}
                </div>
              ))}
            </div>
            <div className="composer">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="پاسخ کارشناس…"
                rows={2}
                disabled={selected.status !== "with_agent"}
              />
              <button
                className="btn"
                type="button"
                disabled={busy || selected.status !== "with_agent" || !reply.trim()}
                onClick={sendReply}
              >
                ارسال
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
