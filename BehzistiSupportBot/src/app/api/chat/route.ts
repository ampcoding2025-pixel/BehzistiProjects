import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { invalidateKnowledgeCache } from "@/lib/knowledge";
import { buildAnswer, retrieve, wantsHuman } from "@/lib/rag";
import { generateWithOllama, getOllamaConfig } from "@/lib/ollama";
import {
  generateWithCopilot,
  getAiProvider,
  getCopilotStatus,
} from "@/lib/ai-provider";
import {
  appendMessage,
  createSession,
  getSession,
  setSessionStatus,
} from "@/lib/store";
import type { ChatApiResponse } from "@/lib/types";

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

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      sessionId?: string;
      message?: string;
      userLabel?: string;
      appId?: string;
    };

    const appId =
      body.appId?.trim() ||
      req.headers.get("x-app-id")?.trim() ||
      "default";

    const text = (body.message ?? "").trim();
    if (!text) {
      return withCors(NextResponse.json({ error: "پیام خالی است." }, { status: 400 }));
    }

    let session = body.sessionId ? await getSession(body.sessionId) : null;
    if (session?.status === "with_agent" || session?.status === "waiting_agent") {
      await appendMessage(session.id, { role: "user", content: text });
      const updated = await getSession(session.id);
      return withCors(
        NextResponse.json({
          sessionId: session.id,
          message: updated!.messages[updated!.messages.length - 1],
          status: updated!.status,
          handoffSuggested: false,
          note:
            updated!.status === "waiting_agent"
              ? "در صف کارشناس هستید."
              : "پیام برای کارشناس ارسال شد.",
        }),
      );
    }

    if (wantsHuman(text)) {
      if (!session) {
        session = await createSession(body.userLabel, appId);
      }
      await appendMessage(session.id, { role: "user", content: text });
      await setSessionStatus(session.id, "waiting_agent");
      const msg = await appendMessage(session.id, {
        role: "assistant",
        content:
          "درخواست شما ثبت شد. در حال اتصال به کارشناس زنده سازمان بهزیستی هستم. لطفاً منتظر بمانید.",
        confidence: 0,
      });
      const response: ChatApiResponse = {
        sessionId: session.id,
        message: msg.messages[msg.messages.length - 1],
        status: "waiting_agent",
        handoffSuggested: true,
      };
      return withCors(NextResponse.json(response));
    }

    const selectedProvider = await getAiProvider();
    if (selectedProvider === "copilot") {
      const status = await getCopilotStatus();
      if (!status.connected) {
        return withCors(
          NextResponse.json(
            {
              error:
                status.error ??
                "GitHub Copilot is not connected. Check Settings → AI provider.",
            },
            { status: 503 },
          ),
        );
      }
    }

    if (!session) {
      session = await createSession(body.userLabel, appId);
    }
    await appendMessage(session.id, { role: "user", content: text });

    const scopeAppId = session.appId || appId;
    invalidateKnowledgeCache();
    const chunks = await retrieve(text, 3, scopeAppId);
    const built = buildAnswer(text, chunks);

    let content = built.content;
    let confidence = built.confidence;
    let handoffSuggested = built.handoffSuggested;
    let provider: "ollama" | "copilot" | "lexical" = "lexical";
    let ollamaModel: string | undefined;
    let copilotModel: string | undefined;

    if (selectedProvider === "copilot") {
      const llm = await generateWithCopilot({
        question: text,
        chunks,
        appId: scopeAppId,
      });
      if (llm.content) {
        content = llm.content;
        provider = "copilot";
        copilotModel = llm.model;
        if (/نمی[‌ ]?دانم|کارشناس زنده|اطمینان ندارم/i.test(llm.content)) {
          handoffSuggested = true;
        }
      } else {
        console.error("[copilot generation]", llm.error);
        return withCors(
          NextResponse.json(
            {
              error: llm.error ?? "GitHub Copilot could not generate a response.",
              sessionId: session.id,
            },
            { status: 502 },
          ),
        );
      }
    } else {
      const ollamaCfg = getOllamaConfig();
      if (ollamaCfg.enabled && chunks.length > 0) {
        const llm = await generateWithOllama({
          question: text,
          chunks,
          appId: scopeAppId,
          config: ollamaCfg,
        });
        if (llm.usedOllama && llm.content) {
          content = llm.content;
          provider = "ollama";
          ollamaModel = llm.model;
          // Keep retrieval confidence; add soft handoff cue if model abstains.
          if (/نمی[‌ ]?دانم|کارشناس زنده|اطمینان ندارم/i.test(llm.content)) {
            handoffSuggested = true;
          }
        } else if (llm.error) {
          console.warn("[ollama fallback]", llm.error);
        }
      } else if (ollamaCfg.enabled && chunks.length === 0) {
        // Still try Ollama with empty context so it can politely abstain.
        const llm = await generateWithOllama({
          question: text,
          chunks: [],
          appId: scopeAppId,
          config: ollamaCfg,
        });
        if (llm.usedOllama && llm.content) {
          content = llm.content;
          provider = "ollama";
          ollamaModel = llm.model;
          confidence = 0;
          handoffSuggested = true;
        }
      }
    }

    if (confidence === 0) {
      await setSessionStatus(session.id, "waiting_agent");
    }

    const assistant = await appendMessage(session.id, {
      id: randomUUID(),
      role: "assistant",
      content,
      confidence,
      sources: chunks.map((c) => ({
        id: c.doc.id,
        title: c.doc.title,
        source: c.doc.source,
        score: Number(c.score.toFixed(3)),
      })),
    });

    const fresh = await getSession(session.id);
    const response = {
      sessionId: session.id,
      message: assistant.messages[assistant.messages.length - 1],
      status: fresh!.status,
      handoffSuggested,
      provider,
      ollamaModel: ollamaModel ?? null,
      copilotModel: copilotModel ?? null,
    } satisfies ChatApiResponse & {
      provider: "ollama" | "copilot" | "lexical";
      ollamaModel: string | null;
      copilotModel: string | null;
    };
    return withCors(NextResponse.json(response));
  } catch (err) {
    console.error(err);
    return withCors(NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 }));
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");
  if (!sessionId) {
    return withCors(NextResponse.json({ error: "sessionId لازم است" }, { status: 400 }));
  }
  const session = await getSession(sessionId);
  if (!session) {
    return withCors(NextResponse.json({ error: "جلسه پیدا نشد" }, { status: 404 }));
  }
  return withCors(NextResponse.json(session));
}
