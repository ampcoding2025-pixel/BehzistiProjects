import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import type { ChatMessage, ChatSession, SessionStatus } from "./types";

const RUNTIME = path.join(process.cwd(), "data", "runtime");
const SESSIONS_FILE = path.join(RUNTIME, "sessions.json");

type StoreShape = {
  sessions: Record<string, ChatSession>;
};

async function ensureStore(): Promise<StoreShape> {
  await mkdir(RUNTIME, { recursive: true });
  try {
    const raw = await readFile(SESSIONS_FILE, "utf8");
    return JSON.parse(raw) as StoreShape;
  } catch {
    const empty: StoreShape = { sessions: {} };
    await writeFile(SESSIONS_FILE, JSON.stringify(empty, null, 2), "utf8");
    return empty;
  }
}

async function saveStore(store: StoreShape) {
  await mkdir(RUNTIME, { recursive: true });
  await writeFile(SESSIONS_FILE, JSON.stringify(store, null, 2), "utf8");
}

export async function createSession(userLabel?: string, appId?: string): Promise<ChatSession> {
  const store = await ensureStore();
  const now = new Date().toISOString();
  const session: ChatSession = {
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
    status: "bot",
    userLabel: userLabel || "کاربر",
    appId: appId || "default",
    messages: [
      {
        id: randomUUID(),
        role: "assistant",
        content:
          "سلام، به سامانه هوشمند پاسخگویی و پشتیبانی سازمانی سازمان بهزیستی کشور خوش آمدید. سؤال خود را درباره بخشنامه‌ها، قوانین، خدمات و پاسخ‌های سازمانی بپرسید. اگر پاسخ کافی نبود، شما را به کارشناس زنده وصل می‌کنم.",
        createdAt: now,
      },
    ],
  };
  store.sessions[session.id] = session;
  await saveStore(store);
  return session;
}

export async function getSession(id: string): Promise<ChatSession | null> {
  const store = await ensureStore();
  return store.sessions[id] ?? null;
}

export async function listSessions(): Promise<ChatSession[]> {
  const store = await ensureStore();
  return Object.values(store.sessions).sort(
    (a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt),
  );
}

export async function appendMessage(
  sessionId: string,
  message: Omit<ChatMessage, "id" | "createdAt"> & Partial<Pick<ChatMessage, "id" | "createdAt">>,
): Promise<ChatSession> {
  const store = await ensureStore();
  const session = store.sessions[sessionId];
  if (!session) throw new Error("SESSION_NOT_FOUND");

  const full: ChatMessage = {
    id: message.id ?? randomUUID(),
    createdAt: message.createdAt ?? new Date().toISOString(),
    role: message.role,
    content: message.content,
    sources: message.sources,
    confidence: message.confidence,
  };
  session.messages.push(full);
  session.updatedAt = full.createdAt;
  store.sessions[sessionId] = session;
  await saveStore(store);
  return session;
}

export async function setSessionStatus(
  sessionId: string,
  status: SessionStatus,
  extra?: Partial<Pick<ChatSession, "agentId" | "agentName">>,
): Promise<ChatSession> {
  const store = await ensureStore();
  const session = store.sessions[sessionId];
  if (!session) throw new Error("SESSION_NOT_FOUND");
  session.status = status;
  session.updatedAt = new Date().toISOString();
  if (extra?.agentId) session.agentId = extra.agentId;
  if (extra?.agentName) session.agentName = extra.agentName;
  store.sessions[sessionId] = session;
  await saveStore(store);
  return session;
}
