import { NextRequest, NextResponse } from "next/server";
import { appendMessage, getOrCreateSession, getSession } from "@/lib/chat-sessions";
import { askLlm } from "@/lib/llm";

/** SupportChatWidget protocol + legacy {messages} format */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // Legacy ChatWidget format
  if (Array.isArray(body.messages)) {
    const messages = body.messages as { role: "user" | "assistant"; text: string }[];
    const lastUser = [...messages].reverse().find((m) => m.role === "user")?.text?.trim() ?? "";
    if (!lastUser) return NextResponse.json({ error: "empty_message" }, { status: 400 });
    const result = await askLlm({
      question: lastUser,
      history: messages.map((m) => ({ role: m.role, content: m.text })),
    });
    return NextResponse.json(result);
  }

  // SupportChatWidget format
  const message = String(body.message ?? "").trim();
  if (!message) return NextResponse.json({ error: "empty_message" }, { status: 400 });

  const appId = String(body.appId ?? "aiticket-management");
  const session = getOrCreateSession(
    typeof body.sessionId === "string" ? body.sessionId : null,
    appId,
  );

  appendMessage(session, {
    id: `u-${Date.now()}`,
    role: "user",
    content: message,
    createdAt: new Date().toISOString(),
  });

  const history = session.messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .filter((m) => m.id !== "welcome")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  const result = await askLlm({ question: message, history });
  const assistantMsg = {
    id: `a-${Date.now()}`,
    role: "assistant" as const,
    content: result.reply,
    createdAt: new Date().toISOString(),
  };
  appendMessage(session, assistantMsg);

  return NextResponse.json({
    sessionId: session.id,
    message: assistantMsg,
    status: session.status,
    handoffSuggested: false,
    provider: result.provider,
    model: result.model,
  });
}

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }
  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "جلسه پیدا نشد" }, { status: 404 });
  }
  return NextResponse.json({
    id: session.id,
    status: session.status,
    messages: session.messages,
  });
}
