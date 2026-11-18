import { promises as fs } from "fs";
import path from "path";
import { getDiskType } from "@/lib/catalog";
import type { DiskRequest, RequestStatus } from "@/lib/types";
import { MOCK_REQUESTS } from "@/lib/mock-requests";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "requests.json");

export interface RequestPageQuery {
  page?: number;
  pageSize?: number;
  /** Free-text search across id, title, period, requester, status, file, Armaghan id, disk type */
  q?: string;
}

export interface RequestPageResult {
  items: DiskRequest[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  q: string;
  counts: {
    ready: number;
    handed_to_finance: number;
    failed_or_running: number;
  };
}

async function ensureFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(FILE);
  } catch {
    await fs.writeFile(FILE, JSON.stringify(MOCK_REQUESTS, null, 2), "utf8");
  }
}

async function readAll(): Promise<DiskRequest[]> {
  await ensureFile();
  const raw = await fs.readFile(FILE, "utf8");
  const rows = JSON.parse(raw) as DiskRequest[];
  return rows.sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1));
}

export async function listRequests(): Promise<DiskRequest[]> {
  return readAll();
}

function matchesQuery(row: DiskRequest, q: string) {
  if (!q) return true;
  const disk = getDiskType(row.diskTypeId);
  const hay = [
    row.id,
    row.title,
    row.periodLabel,
    row.requestedBy,
    row.status,
    row.fileName,
    row.errorMessage,
    row.armaghanTransactionId,
    row.diskTypeId,
    disk?.titleFa,
    disk?.family,
    disk?.family === "mostamari" ? "مستمری" : "یارانه",
    ...(row.logTail ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export async function listRequestsPage(
  query: RequestPageQuery = {},
): Promise<RequestPageResult> {
  const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 8));
  const page = Math.max(1, Number(query.page) || 1);
  const q = (query.q || "").trim().toLowerCase();
  const allRaw = await readAll();
  const filtered = q ? allRaw.filter((r) => matchesQuery(r, q)) : allRaw;
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;

  // Counts stay global (dashboard), not search-scoped
  const counts = {
    ready: allRaw.filter((r) => r.status === "ready").length,
    handed_to_finance: allRaw.filter((r) => r.status === "handed_to_finance").length,
    failed_or_running: allRaw.filter(
      (r) => r.status === "failed" || r.status === "running",
    ).length,
  };

  return {
    items: filtered.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
    totalPages,
    q,
    counts,
  };
}

export async function getRequest(id: string): Promise<DiskRequest | null> {
  const rows = await readAll();
  return rows.find((r) => r.id === id) ?? null;
}

export async function saveRequests(rows: DiskRequest[]) {
  await ensureFile();
  await fs.writeFile(FILE, JSON.stringify(rows, null, 2), "utf8");
}

export async function upsertRequest(row: DiskRequest) {
  const rows = await readAll();
  const idx = rows.findIndex((r) => r.id === row.id);
  if (idx >= 0) rows[idx] = row;
  else rows.unshift(row);
  await saveRequests(rows);
  return row;
}

export function nextRequestId(existing: DiskRequest[]) {
  const n = existing.length + 1;
  const stamp = new Date();
  const y = stamp.getFullYear();
  return `REQ-${y}-${String(n).padStart(3, "0")}-${stamp.getTime().toString(36).slice(-4)}`;
}

export function nowLabel() {
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());
}

export type { RequestStatus };
