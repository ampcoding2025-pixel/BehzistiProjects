import { randomUUID } from "crypto";
import path from "path";
import { mkdir, readFile, rename, writeFile } from "fs/promises";
import { CopilotClient, RuntimeConnection } from "@microsoft/copilot-sdk";
import { getOllamaConfig, isOllamaReady } from "@/lib/ollama";
import type { RetrievedChunk } from "@/lib/types";

export type AiProvider = "ollama" | "copilot";

export type AiProviderStatus = {
  connected: boolean;
  model: string | null;
  models: string[];
  error: string | null;
};

const RUNTIME_DIR = path.join(process.cwd(), "data", "runtime");
const PROVIDER_FILE = path.join(RUNTIME_DIR, "ai-provider.json");

let copilotClientPromise: Promise<CopilotClient> | null = null;

function isProvider(value: unknown): value is AiProvider {
  return value === "ollama" || value === "copilot";
}

export async function getAiProvider(): Promise<AiProvider> {
  let raw: string;
  try {
    raw = await readFile(PROVIDER_FILE, "utf8");
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return "ollama";
    }
    throw error;
  }

  const parsed: unknown = JSON.parse(raw);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("provider" in parsed) ||
    !isProvider(parsed.provider)
  ) {
    throw new Error("Invalid AI provider configuration");
  }
  return parsed.provider;
}

export async function setAiProvider(provider: AiProvider): Promise<void> {
  await mkdir(RUNTIME_DIR, { recursive: true });
  const tempFile = path.join(RUNTIME_DIR, `ai-provider-${randomUUID()}.tmp`);
  await writeFile(tempFile, JSON.stringify({ provider }, null, 2), "utf8");
  await rename(tempFile, PROVIDER_FILE);
}

async function getCopilotClient(): Promise<CopilotClient> {
  if (!copilotClientPromise) {
    const client = new CopilotClient({
      mode: "coding-agent",
      runtime: RuntimeConnection.forSpawnedStdio(),
      github: { useLoggedInUser: true },
    });
    copilotClientPromise = client.start().then(
      () => client,
      (error: unknown) => {
        copilotClientPromise = null;
        throw error;
      },
    );
  }
  return copilotClientPromise;
}

export async function getCopilotStatus(): Promise<AiProviderStatus> {
  try {
    const client = await getCopilotClient();
    const auth = await client.getAuthStatus();
    if (!auth.isAuthenticated) {
      return {
        connected: false,
        model: null,
        models: [],
        error: "Not authenticated",
      };
    }

    const models = await client.listModels();
    const modelIds = models.map((model) => model.id);
    return {
      connected: modelIds.length > 0,
      model: "auto",
      models: modelIds,
      error: modelIds.length ? null : "No Copilot models are available for this account.",
    };
  } catch (error) {
    console.error("[copilot status]", error);
    return {
      connected: false,
      model: null,
      models: [],
      error: error instanceof Error ? error.message : "Could not connect to GitHub Copilot.",
    };
  }
}

export async function getAiProviderStatuses(): Promise<Record<AiProvider, AiProviderStatus>> {
  const config = getOllamaConfig();
  const [ollamaStatus, copilotStatus] = await Promise.all([
    isOllamaReady(config),
    getCopilotStatus(),
  ]);
  return {
    ollama: {
      connected: config.enabled && ollamaStatus.ok,
      model: config.model,
      models: ollamaStatus.models,
      error: config.enabled ? (ollamaStatus.error ?? null) : "Ollama is disabled.",
    },
    copilot: copilotStatus,
  };
}

function buildContext(chunks: RetrievedChunk[]): string {
  if (!chunks.length) return "(هیچ سند مرتبطی یافت نشد)";
  return chunks
    .map((chunk, index) => {
      const source =
        chunk.doc.source === "faq"
          ? "پرسش‌های متداول"
          : chunk.doc.source === "circular"
            ? "بخشنامه"
            : "قوانین و ضوابط";
      const validity =
        chunk.doc.meta?.validity === "available_unvalidated"
          ? " · پاسخ تاریخی؛ اعتبارسنجی‌نشده"
          : "";
      return `[${index + 1}] (${source}${validity}) ${chunk.doc.title}\n${chunk.doc.text}`;
    })
    .join("\n\n");
}

export async function generateWithCopilot(args: {
  question: string;
  chunks: RetrievedChunk[];
  appId: string;
}): Promise<{ content: string; model: string; error?: string }> {
  const client = await getCopilotClient();
  let session: Awaited<ReturnType<typeof client.createSession>> | null = null;
  try {
    session = await client.createSession({
      model: "auto",
      systemMessage: {
        mode: "replace",
        content: `تو دستیار هوشمند «سامانه هوشمند پاسخگویی و پشتیبانی سازمانی» سازمان بهزیستی کشور هستی.
فقط به فارسی رسمی و کوتاه پاسخ بده.
فقط بر اساس اسناد دانش سازمانی ارائه‌شده پاسخ بده.
پاسخ‌های تاریخی دیده‌بان اعتبارسنجی نشده‌اند؛ آن‌ها را قانون یا وضعیت قطعی و جاری معرفی نکن و در صورت استناد، تاریخی‌بودنشان را روشن کن.
اگر اسناد کافی نیست یا مطمئن نیستی، صریح بگو نمی‌دانم و پیشنهاد اتصال به کارشناس زنده بده.
عدد یا قانون قطعی اختراع نکن.
در پایان، منابع استفاده‌شده را با شماره سند ذکر کن.
دامنه برنامه: ${args.appId}`,
      },
      tools: { availableTools: [] },
    });
    const response = await session.sendAndWait(
      {
        prompt: `اسناد دانش:\n${buildContext(args.chunks)}\n\nسؤال کاربر:\n${args.question}`,
      },
      90000,
    );
    const content = response?.data.content.trim();
    if (!content) {
      return { content: "", model: "auto", error: "GitHub Copilot returned an empty response." };
    }
    return { content, model: response?.data.model ?? "auto" };
  } catch (error) {
    return {
      content: "",
      model: "auto",
      error: error instanceof Error ? error.message : "GitHub Copilot request failed.",
    };
  } finally {
    if (session) await client.deleteSession(session.sessionId);
  }
}
