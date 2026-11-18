import { NextRequest, NextResponse } from "next/server";
import { appendMessage, getSession } from "@/lib/chat-sessions";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { sessionId?: string };
  if (!body.sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }
  const session = getSession(body.sessionId);
  if (!session) {
    return NextResponse.json({ error: "جلسه پیدا نشد" }, { status: 404 });
  }
  session.status = "waiting_agent";
  appendMessage(session, {
    id: `sys-${Date.now()}`,
    role: "system",
    content: "ارجاع به کارشناس در این نسخه آزمایشی فعال نیست. لطفاً از مسیر صفحات داشبورد برای بررسی ادامه دهید.",
    createdAt: new Date().toISOString(),
  });
  return NextResponse.json({
    id: session.id,
    status: session.status,
    messages: session.messages,
  });
}
