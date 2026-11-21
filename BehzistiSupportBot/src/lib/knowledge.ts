import { readdir, readFile } from "fs/promises";
import path from "path";
import { loadEnabledDatabaseDocs } from "./didban-sources";
import type { KnowledgeDoc } from "./types";

const ROOT = path.join(process.cwd(), "data", "knowledge");

type FaqItem = {
  id: string;
  title: string;
  category?: string;
  tags?: string[];
  appIds?: string[];
  question: string;
  answer: string;
};

type CircularItem = {
  id: string;
  title: string;
  number?: string;
  date?: string;
  tags?: string[];
  appIds?: string[];
  summary: string;
  body: string;
};

type LawItem = {
  id: string;
  title: string;
  source?: string;
  tags?: string[];
  appIds?: string[];
  summary: string;
  body: string;
};

let cache: KnowledgeDoc[] | null = null;

async function readJson<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

async function loadJsonFolder<T>(folder: string): Promise<T[]> {
  const dir = path.join(ROOT, folder);
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  const chunks = await Promise.all(files.map((f) => readJson<T[]>(path.join(dir, f))));
  return chunks.flat();
}

export async function loadKnowledge(): Promise<KnowledgeDoc[]> {
  if (cache) return cache;

  const [faqs, circulars, laws] = await Promise.all([
    loadJsonFolder<FaqItem>("faq"),
    loadJsonFolder<CircularItem>("circulars"),
    loadJsonFolder<LawItem>("laws"),
  ]);

  const docs: KnowledgeDoc[] = [
    ...faqs.map((item) => ({
      id: item.id,
      source: "faq" as const,
      title: item.title,
      text: `${item.question}\n${item.answer}`,
      tags: item.tags ?? [],
      appIds: item.appIds ?? ["*"],
      meta: { category: item.category ?? "" },
    })),
    ...circulars.map((item) => ({
      id: item.id,
      source: "circular" as const,
      title: item.title,
      text: `${item.summary}\n${item.body}`,
      tags: item.tags ?? [],
      appIds: item.appIds ?? ["*"],
      meta: {
        number: item.number ?? "",
        date: item.date ?? "",
      },
    })),
    ...laws.map((item) => ({
      id: item.id,
      source: "law" as const,
      title: item.title,
      text: `${item.summary}\n${item.body}`,
      tags: item.tags ?? [],
      appIds: item.appIds ?? ["*"],
      meta: { source: item.source ?? "" },
    })),
    ...(await loadEnabledDatabaseDocs()),
  ];

  cache = docs;
  return docs;
}

export function invalidateKnowledgeCache() {
  cache = null;
}
