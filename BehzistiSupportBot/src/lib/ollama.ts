import type { RetrievedChunk } from "./types";

const SOURCE_LABEL: Record<string, string> = {
  faq: "پاسخ‌های گذشته / پرسش‌های متداول",
  circular: "بخشنامه",
  law: "قوانین و ضوابط",
};

export type OllamaConfig = {
  baseUrl: string;
  model: string;
  enabled: boolean;
  timeoutMs: number;
};

export function getOllamaConfig(): OllamaConfig {
  const baseUrl = (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
  const model = process.env.OLLAMA_MODEL || "llama3.2";
  const enabled =
    (process.env.OLLAMA_ENABLED || "true").toLowerCase() !== "false" &&
    Boolean(baseUrl && model);
  const timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS || 90000);
  return { baseUrl, model, enabled, timeoutMs };
}

export async function isOllamaReady(config = getOllamaConfig()): Promise<{
  ok: boolean;
  models: string[];
  error?: string;
}> {
  try {
    const res = await fetch(`${config.baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { ok: false, models: [], error: `HTTP ${res.status}` };
    const data = (await res.json()) as { models?: Array<{ name: string }> };
    const models = (data.models ?? []).map((m) => m.name);
    const hasModel = models.some(
      (n) => n === config.model || n.startsWith(`${config.model}:`) || n.split(":")[0] === config.model,
    );
    return {
      ok: hasModel,
      models,
      error: hasModel ? undefined : `مدل ${config.model} نصب نیست. مدل‌های موجود: ${models.join(", ") || "—"}`,
    };
  } catch (err) {
    return {
      ok: false,
      models: [],
      error: err instanceof Error ? err.message : "Ollama در دسترس نیست",
    };
  }
}

function buildContext(chunks: RetrievedChunk[]): string {
  if (!chunks.length) return "(هیچ سند مرتبطی یافت نشد)";
  return chunks
    .map((c, i) => {
      const label = SOURCE_LABEL[c.doc.source] ?? c.doc.source;
      return `[${i + 1}] (${label}) ${c.doc.title}\n${c.doc.text}`;
    })
    .join("\n\n");
}

export async function generateWithOllama(args: {
  question: string;
  chunks: RetrievedChunk[];
  appId?: string;
  config?: OllamaConfig;
}): Promise<{ content: string; usedOllama: boolean; model?: string; error?: string }> {
  const config = args.config ?? getOllamaConfig();
  if (!config.enabled) {
    return { content: "", usedOllama: false, error: "Ollama غیرفعال است" };
  }

  const system = `تو دستیار هوشمند «سامانه هوشمند پاسخگویی و پشتیبانی سازمانی» سازمان بهزیستی کشور هستی.
فقط به فارسی رسمی و کوتاه پاسخ بده.
فقط از روی اسناد دانش سازمانی که در اختیار داری پاسخ بده.
اگر اسناد کافی نیست یا مطمئن نیستی، صریح بگو نمی‌دانم و پیشنهاد اتصال به کارشناس زنده بده.
عدد یا قانون قطعی اختراع نکن.
در پایان، منابع استفاده‌شده را با شماره سند ذکر کن.
دامنه برنامه: ${args.appId || "عمومی"}`;

  const user = `اسناد دانش:
${buildContext(args.chunks)}

سؤال کاربر:
${args.question}`;

  try {
    const res = await fetch(`${config.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(config.timeoutMs),
      body: JSON.stringify({
        model: config.model,
        stream: false,
        options: {
          temperature: 0.2,
          num_predict: 512,
        },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (!res.ok) {
      const raw = await res.text();
      return {
        content: "",
        usedOllama: false,
        error: `Ollama HTTP ${res.status}: ${raw.slice(0, 200)}`,
      };
    }

    const data = (await res.json()) as {
      message?: { content?: string };
      response?: string;
    };
    const content = (data.message?.content || data.response || "").trim();
    if (!content) {
      return { content: "", usedOllama: false, error: "پاسخ خالی از Ollama" };
    }
    return { content, usedOllama: true, model: config.model };
  } catch (err) {
    return {
      content: "",
      usedOllama: false,
      error: err instanceof Error ? err.message : "خطای Ollama",
    };
  }
}
