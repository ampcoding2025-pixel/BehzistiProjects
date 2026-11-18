import { NextResponse } from "next/server";
import { loadKnowledge } from "@/lib/knowledge";

export const runtime = "nodejs";

function withCors(res: NextResponse) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, X-App-Id, Authorization");
  return res;
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const appId = searchParams.get("appId") || req.headers.get("x-app-id") || undefined;
  const source = searchParams.get("source"); // faq | circular | law | all
  const limit = Math.min(Number(searchParams.get("limit") || 20), 50);

  const corpus = searchParams.get("corpus"); // e.g. didban
  const docs = await loadKnowledge();
  const filtered = docs.filter((d) => {
    if (source && source !== "all" && d.source !== source) return false;
    // Widget FAQ list: only Didban frequent topics (didban-frequent-faq.json)
    if (corpus === "didban" && !d.id.startsWith("didban-faq-")) return false;
    if (!appId) return true;
    const ids = d.appIds?.length ? d.appIds : ["*"];
    return ids.includes("*") || ids.includes(appId);
  });

  const faqs = filtered
    .filter((d) => d.source === "faq")
    .slice(0, limit)
    .map((d) => {
      const [questionLine, ...rest] = d.text.split("\n");
      const question = questionLine?.trim() || d.title;
      const answerPreview = rest.join("\n").trim().slice(0, 160);
      return {
        id: d.id,
        title: d.title,
        question,
        answerPreview,
        tags: d.tags,
        category: d.meta?.category || "",
        corpus: d.id.startsWith("didban-") ? "didban" : "general",
      };
    });

  return withCors(
    NextResponse.json({
      count: filtered.length,
      faqCount: faqs.length,
      faqs,
      docs: filtered.slice(0, limit).map((d) => ({
        id: d.id,
        source: d.source,
        title: d.title,
        tags: d.tags,
        meta: d.meta,
      })),
    }),
  );
}
