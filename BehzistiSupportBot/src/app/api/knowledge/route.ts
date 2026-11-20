import { NextResponse } from "next/server";
import { invalidateKnowledgeCache, loadKnowledge } from "@/lib/knowledge";

export const runtime = "nodejs";

function withCors(res: NextResponse) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, X-App-Id, Authorization");
  return res;
}

/** Map UI tab ids → corpus source */
function resolveSourceFilter(raw: string | null): "faq" | "circular" | "law" | "url" | "all" {
  if (!raw || raw === "all") return "all";
  if (raw === "file") return "circular";
  if (raw === "article") return "law";
  if (raw === "url" || raw === "websites") return "url";
  if (raw === "faq" || raw === "circular" || raw === "law") return raw;
  return "all";
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const appId = searchParams.get("appId") || req.headers.get("x-app-id") || undefined;
  const sourceFilter = resolveSourceFilter(searchParams.get("source"));
  const corpus = searchParams.get("corpus"); // e.g. didban

  const pageParam = searchParams.get("page");
  const pageSizeParam = searchParams.get("pageSize") ?? searchParams.get("limit");
  const page = Math.max(1, Number(pageParam || 1) || 1);
  const pageSize = Math.min(Math.max(1, Number(pageSizeParam || 10) || 10), 100);

  // Always reload folder contents so new JSON files appear after Refresh.
  invalidateKnowledgeCache();
  const docs = await loadKnowledge();
  const scoped = docs.filter((d) => {
    if (corpus === "didban" && !d.id.startsWith("didban-faq-")) return false;
    if (!appId) return true;
    const ids = d.appIds?.length ? d.appIds : ["*"];
    return ids.includes("*") || ids.includes(appId);
  });

  const counts = {
    all: scoped.length,
    faq: scoped.filter((d) => d.source === "faq").length,
    file: scoped.filter((d) => d.source === "circular").length,
    article: scoped.filter((d) => d.source === "law").length,
    url: 0,
  };

  const filtered = scoped.filter((d) => {
    if (sourceFilter === "all") return true;
    if (sourceFilter === "url") return false; // websites not backed by folder yet
    return d.source === sourceFilter;
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageDocs = filtered.slice(start, start + pageSize);

  const faqs = filtered
    .filter((d) => d.source === "faq")
    .slice(start, start + pageSize)
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
      page: safePage,
      pageSize,
      total,
      totalPages,
      count: total,
      counts,
      faqCount: counts.faq,
      faqs,
      docs: pageDocs.map((d) => ({
        id: d.id,
        source: d.source,
        title: d.title,
        tags: d.tags,
        meta: d.meta,
      })),
    }),
  );
}
