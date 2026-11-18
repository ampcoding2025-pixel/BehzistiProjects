import { loadKnowledge } from "./knowledge";
import type { RetrievedChunk } from "./types";

const STOP = new Set([
  "و",
  "در",
  "به",
  "از",
  "که",
  "را",
  "این",
  "آن",
  "با",
  "برای",
  "یک",
  "یا",
  "هم",
  "تا",
  "می",
  "های",
  "ها",
  "است",
  "بود",
  "شود",
  "کنم",
  "کنید",
  "چگونه",
  "چطور",
  "چیست",
  "آیا",
]);

function normalize(text: string): string {
  return text
    .replace(/[ي]/g, "ی")
    .replace(/[ك]/g, "ک")
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g, " ")
    .toLowerCase()
    .trim();
}

function tokenize(text: string): string[] {
  return normalize(text)
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

function matchesApp(docAppIds: string[] | undefined, appId?: string): boolean {
  if (!appId) return true;
  const ids = docAppIds?.length ? docAppIds : ["*"];
  return ids.includes("*") || ids.includes(appId);
}

/** Lightweight lexical retrieval — swap later for embeddings / vector DB. */
export async function retrieve(
  query: string,
  topK = 3,
  appId?: string,
): Promise<RetrievedChunk[]> {
  const docs = (await loadKnowledge()).filter((d) => matchesApp(d.appIds, appId));
  const qTokens = tokenize(query);
  if (!qTokens.length) return [];

  const scored = docs.map((doc) => {
    const hay = normalize(`${doc.title} ${doc.text} ${doc.tags.join(" ")}`);
    let score = 0;
    for (const token of qTokens) {
      if (hay.includes(token)) score += 1;
      if (normalize(doc.title).includes(token)) score += 0.5;
      if (doc.tags.some((t) => normalize(t).includes(token))) score += 0.35;
    }
    score = score / Math.sqrt(qTokens.length);
    return { doc, score };
  });

  return scored
    .filter((x) => x.score > 0.35)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

const SOURCE_LABEL: Record<string, string> = {
  faq: "پاسخ‌های گذشته / پرسش‌های متداول",
  circular: "بخشنامه",
  law: "قوانین و ضوابط",
};

export function buildAnswer(
  query: string,
  chunks: RetrievedChunk[],
): { content: string; confidence: number; handoffSuggested: boolean } {
  if (!chunks.length) {
    return {
      content:
        "متأسفانه در دانش سازمانی، بخشنامه‌ها، قوانین و پاسخ‌های ثبت‌شده، پاسخ مطمئنی پیدا نکردم. می‌توانم شما را به کارشناس زنده سازمان بهزیستی وصل کنم.",
      confidence: 0,
      handoffSuggested: true,
    };
  }

  const best = chunks[0].score;
  const confidence = Math.max(0, Math.min(1, best / 2.2));
  const handoffSuggested = confidence < 0.45;

  const lines: string[] = [];
  lines.push("بر اساس دانش سازمانی موجود:");
  lines.push("");
  lines.push(chunks[0].doc.text.split("\n").slice(1).join("\n").trim() || chunks[0].doc.text);
  lines.push("");
  lines.push("منابع:");
  for (const c of chunks) {
    lines.push(
      `• [${SOURCE_LABEL[c.doc.source] ?? c.doc.source}] ${c.doc.title} (امتیاز تطبیق: ${c.score.toFixed(2)})`,
    );
  }

  if (handoffSuggested) {
    lines.push("");
    lines.push(
      "اطمینان پاسخ پایین است. اگر مایلید، روی «اتصال به کارشناس زنده» بزنید تا گفتگو به کارشناس منتقل شود.",
    );
  }

  void query;
  return { content: lines.join("\n"), confidence, handoffSuggested };
}

export function wantsHuman(text: string): boolean {
  const n = normalize(text);
  const triggers = [
    "کارشناس",
    "اپراتور",
    "انسان",
    "پشتیبان زنده",
    "اپراتور زنده",
    "صحبت با کارشناس",
    "وصلم کن",
    "اتصال به کارشناس",
    "agent",
    "human",
  ];
  return triggers.some((t) => n.includes(normalize(t)));
}
