import { NextResponse } from "next/server";
import {
  appendMessage,
  getSession,
  listSessions,
  setSessionStatus,
} from "@/lib/store";

export const runtime = "nodejs";

function withCors(res: NextResponse) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, X-App-Id, Authorization");
  return res;
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

/** User requests live agent, or agent claims / replies. */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      action: "request" | "claim" | "reply" | "close";
      sessionId: string;
      agentId?: string;
      agentName?: string;
      message?: string;
    };

    if (!body.sessionId || !body.action) {
      return withCors(NextResponse.json({ error: "پارامتر ناقص است" }, { status: 400 }));
    }

    const session = await getSession(body.sessionId);
    if (!session) {
      return withCors(NextResponse.json({ error: "جلسه پیدا نشد" }, { status: 404 }));
    }

    if (body.action === "request") {
      const updated = await setSessionStatus(body.sessionId, "waiting_agent");
      await appendMessage(body.sessionId, {
        role: "assistant",
        content:
          "درخواست اتصال به کارشناس زنده ثبت شد. به‌محض آزاد شدن کارشناس، گفتگو ادامه می‌یابد.",
      });
      return withCors(NextResponse.json(await getSession(updated.id)));
    }

    if (body.action === "claim") {
      const name = body.agentName?.trim() || "کارشناس بهزیستی";
      const updated = await setSessionStatus(body.sessionId, "with_agent", {
        agentId: body.agentId || "agent-1",
        agentName: name,
      });
      await appendMessage(body.sessionId, {
        role: "system",
        content: `${name} به گفتگو پیوست.`,
      });
      return withCors(NextResponse.json(await getSession(updated.id)));
    }

    if (body.action === "reply") {
      const text = (body.message ?? "").trim();
      if (!text) {
        return withCors(NextResponse.json({ error: "پیام خالی است" }, { status: 400 }));
      }
      if (session.status !== "with_agent") {
        return withCors(
          NextResponse.json(
            { error: "ابتدا جلسه را به کارشناس اختصاص دهید" },
            { status: 400 },
          ),
        );
      }
      await appendMessage(body.sessionId, {
        role: "agent",
        content: text,
      });
      return withCors(NextResponse.json(await getSession(body.sessionId)));
    }

    if (body.action === "close") {
      await setSessionStatus(body.sessionId, "closed");
      await appendMessage(body.sessionId, {
        role: "system",
        content: "گفتگو توسط کارشناس بسته شد. در صورت نیاز می‌توانید سؤال جدیدی بپرسید.",
      });
      return withCors(NextResponse.json(await getSession(body.sessionId)));
    }

    return withCors(NextResponse.json({ error: "action نامعتبر" }, { status: 400 }));
  } catch (err) {
    console.error(err);
    return withCors(NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 }));
  }
}

export async function GET() {
  const sessions = await listSessions();
  const queue = sessions.filter(
    (s) => s.status === "waiting_agent" || s.status === "with_agent",
  );
  return withCors(NextResponse.json({ sessions: queue, all: sessions }));
}
