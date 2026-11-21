import { createHash, randomUUID } from "crypto";
import { mkdir, readFile, rename, rm, writeFile } from "fs/promises";
import path from "path";
import { isIP } from "net";
import type { KnowledgeDoc } from "./types";

const RUNTIME_DIR = path.join(process.cwd(), "data", "runtime");
const CONNECTIONS_FILE = path.join(RUNTIME_DIR, "database-connections.json");
const PAGE_SIZE = 100;
const MAX_PAGES = 10_000;
let docsByConnection = new Map<string, KnowledgeDoc[]>();

export type DatabaseConnection = {
  id: string;
  name: string;
  endpoint: string;
  enabled: boolean;
  syncedAt: string | null;
  syncedCases: number;
};

export type DatabaseConnectionStatus = DatabaseConnection & {
  host: string;
  connected: boolean;
  error: string | null;
  credentials: "managed-on-upstream";
};

export function getConfiguredDatabaseEndpoint(): string {
  return normalizeDatabaseEndpoint(process.env.DIDBAN_KNOWLEDGE_API || "http://localhost:5088");
}

type CasesPage = {
  items?: Array<{
    id?: string;
    requestClass?: string;
    subjectName?: string;
    departmentName?: string;
    answerExcerpt?: string | null;
  }>;
  page?: number;
  pageSize?: number;
  total?: number;
};

function isMissingFile(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function isPrivateIpv4(host: string): boolean {
  if (isIP(host) !== 4) return false;
  const octets = host.split(".").map(Number);
  return (
    octets[0] === 10 ||
    octets[0] === 127 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
}

export function normalizeDatabaseEndpoint(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Enter the private AiTicket API address.");
  }

  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Enter a valid HTTP or HTTPS address.");
  }

  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const localHost = host === "localhost" || host === "::1";
  if (
    !["http:", "https:"].includes(url.protocol) ||
    (!localHost && !isPrivateIpv4(host)) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== "/" && url.pathname !== "")
  ) {
    throw new Error("Use a private IPv4 address or localhost with no path or credentials.");
  }

  return url.origin;
}

function requireConfiguredEndpoint(value: unknown): string {
  const endpoint = normalizeDatabaseEndpoint(value);
  if (endpoint !== getConfiguredDatabaseEndpoint()) {
    throw new Error("Only the AiTicket API address configured on this server can be used.");
  }
  return endpoint;
}

async function readConnections(): Promise<DatabaseConnection[]> {
  try {
    const raw = await readFile(CONNECTIONS_FILE, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (
      !Array.isArray(parsed) ||
      parsed.some(
        (item) =>
          typeof item !== "object" ||
          item === null ||
          !("id" in item) ||
          typeof item.id !== "string" ||
          !/^[0-9a-f-]{36}$/i.test(item.id) ||
          !("name" in item) ||
          typeof item.name !== "string" ||
          !item.name.trim() ||
          !("endpoint" in item) ||
          typeof item.endpoint !== "string" ||
          normalizeDatabaseEndpoint(item.endpoint) !== item.endpoint ||
          !("enabled" in item) ||
          typeof item.enabled !== "boolean" ||
          !("syncedAt" in item) ||
          (item.syncedAt !== null && typeof item.syncedAt !== "string") ||
          !("syncedCases" in item) ||
          !Number.isSafeInteger(item.syncedCases) ||
          (item.syncedCases as number) < 0,
      )
    ) {
      throw new Error("Invalid database connection configuration.");
    }
    return parsed as DatabaseConnection[];
  } catch (error) {
    if (isMissingFile(error)) return [];
    throw error;
  }
}

async function writeConnections(connections: DatabaseConnection[]): Promise<void> {
  await mkdir(RUNTIME_DIR, { recursive: true });
  const tempFile = path.join(RUNTIME_DIR, `database-connections-${randomUUID()}.tmp`);
  await writeFile(tempFile, JSON.stringify(connections, null, 2), "utf8");
  await rename(tempFile, CONNECTIONS_FILE);
}

function getConnectionOrThrow(
  connections: DatabaseConnection[],
  id: string,
): DatabaseConnection {
  const connection = connections.find((item) => item.id === id);
  if (!connection) throw new Error("Database connection not found.");
  return connection;
}

function casesEndpoint(endpoint: string, page: number): string {
  const url = new URL("/api/v1/knowledge/answers/cases", endpoint);
  url.searchParams.set("page", String(page));
  url.searchParams.set("pageSize", String(PAGE_SIZE));
  return url.toString();
}

async function requestJson(url: string, timeoutMs = 20_000): Promise<unknown> {
  const response = await fetch(url, {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(timeoutMs),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`AiTicket API returned HTTP ${response.status}.`);
  }
  try {
    return await response.json();
  } catch {
    throw new Error("AiTicket API returned an invalid JSON response.");
  }
}

export async function testDatabaseEndpoint(
  endpointInput: unknown,
  timeoutMs = 20_000,
): Promise<void> {
  const endpoint = requireConfiguredEndpoint(endpointInput);
  const url = new URL("/api/v1/knowledge/answers/summary", endpoint);
  await requestJson(url.toString(), timeoutMs);
}

function toKnowledgeDocs(page: CasesPage): KnowledgeDoc[] {
  return (page.items ?? [])
    .filter((item) => item.id && item.answerExcerpt?.trim())
    .map((item) => {
      const answer = item.answerExcerpt!
        .replace(/(?<![0-9۰-۹])[0-9۰-۹]{10}(?![0-9۰-۹])/g, "[کد ملی]")
        .replace(/0[0-9۰-۹]{9,10}/g, "[تلفن]")
        .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[رایانامه]");
      const topic = [item.requestClass, item.subjectName].filter(Boolean).join(" · ");
      const id = createHash("sha256").update(item.id!).digest("hex").slice(0, 24);
      return {
        id: `didban-case-${id}`,
        source: "faq" as const,
        title: `پاسخ تاریخی دیده‌بان${topic ? ` · ${topic}` : ""}`,
        text: `موضوع: ${topic || "نامشخص"}\nپاسخ ثبت‌شده (اعتبارسنجی‌نشده): ${answer}`,
        tags: [item.requestClass, item.subjectName, item.departmentName].filter(
          (tag): tag is string => Boolean(tag?.trim()),
        ),
        appIds: ["behzisti-portal"],
        meta: {
          category: "پاسخ تاریخی دیده‌بان · اعتبارسنجی‌نشده",
          validity: "available_unvalidated",
        },
      };
    });
}

async function syncCases(endpoint: string): Promise<KnowledgeDoc[]> {
  const firstUrl = casesEndpoint(endpoint, 1);
  const firstValue = await requestJson(firstUrl);
  if (typeof firstValue !== "object" || firstValue === null) {
    throw new Error("AiTicket API returned an invalid cases page.");
  }
  const first = firstValue as CasesPage;
  const total = first.total;
  const pageSize = first.pageSize ?? PAGE_SIZE;
  if (
    !Array.isArray(first.items) ||
    !Number.isSafeInteger(total) ||
    total! < 0 ||
    !Number.isSafeInteger(pageSize) ||
    pageSize < 1
  ) {
    throw new Error("AiTicket API returned invalid pagination metadata.");
  }

  const pageCount = Math.ceil(total! / pageSize);
  if (pageCount > MAX_PAGES) {
    throw new Error(`AiTicket API returned too many pages to sync (${pageCount}).`);
  }

  const docs = toKnowledgeDocs(first);
  for (let pageNumber = 2; pageNumber <= pageCount; pageNumber += 1) {
    const value = await requestJson(casesEndpoint(endpoint, pageNumber));
    if (typeof value !== "object" || value === null || !Array.isArray((value as CasesPage).items)) {
      throw new Error(`AiTicket API returned an invalid cases page (${pageNumber}).`);
    }
    docs.push(...toKnowledgeDocs(value as CasesPage));
  }
  return docs;
}

function indexPath(id: string): string {
  return path.join(RUNTIME_DIR, `didban-cases-${id}.json`);
}

export async function listDatabaseConnections(): Promise<DatabaseConnection[]> {
  return readConnections();
}

export async function listDatabaseConnectionStatuses(): Promise<DatabaseConnectionStatus[]> {
  const connections = await readConnections();
  return Promise.all(
    connections.map(async (connection) => {
      let connected = false;
      let error: string | null = null;
      try {
        await testDatabaseEndpoint(connection.endpoint, 5_000);
        connected = true;
      } catch (cause) {
        error = cause instanceof Error ? cause.message : "Could not reach the AiTicket API.";
      }

      const url = new URL(connection.endpoint);
      return {
        ...connection,
        host: url.host,
        connected,
        error,
        credentials: "managed-on-upstream",
      };
    }),
  );
}

export async function addDatabaseConnection(input: {
  name: unknown;
  endpoint: unknown;
}): Promise<DatabaseConnection> {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || name.length > 80) throw new Error("Connection name must be 1–80 characters.");
  const endpoint = requireConfiguredEndpoint(input.endpoint);
  const connections = await readConnections();
  if (connections.some((connection) => connection.endpoint === endpoint)) {
    throw new Error("This AiTicket API address is already in the connection list.");
  }
  const connection: DatabaseConnection = {
    id: randomUUID(),
    name,
    endpoint,
    enabled: false,
    syncedAt: null,
    syncedCases: 0,
  };
  await writeConnections([connection, ...connections]);
  return connection;
}

export async function updateDatabaseConnection(input: {
  id: string;
  name: unknown;
  endpoint: unknown;
}): Promise<DatabaseConnection> {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || name.length > 80) throw new Error("Connection name must be 1–80 characters.");
  const endpoint = requireConfiguredEndpoint(input.endpoint);
  const connections = await readConnections();
  const current = getConnectionOrThrow(connections, input.id);
  if (
    connections.some(
      (connection) => connection.id !== current.id && connection.endpoint === endpoint,
    )
  ) {
    throw new Error("This AiTicket API address is already in the connection list.");
  }
  const endpointChanged = endpoint !== current.endpoint;
  const updated: DatabaseConnection = {
    ...current,
    name,
    endpoint,
    enabled: endpointChanged ? false : current.enabled,
    syncedAt: endpointChanged ? null : current.syncedAt,
    syncedCases: endpointChanged ? 0 : current.syncedCases,
  };
  await writeConnections(connections.map((item) => (item.id === current.id ? updated : item)));
  if (endpointChanged) {
    await rm(indexPath(current.id), { force: true });
    docsByConnection.delete(current.id);
  }
  return updated;
}

export async function removeDatabaseConnection(id: string): Promise<void> {
  const connections = await readConnections();
  getConnectionOrThrow(connections, id);
  await writeConnections(connections.filter((item) => item.id !== id));
  await rm(indexPath(id), { force: true });
  docsByConnection.delete(id);
}

export async function syncDatabaseConnection(id: string): Promise<DatabaseConnection> {
  const connections = await readConnections();
  const connection = getConnectionOrThrow(connections, id);
  const docs = await syncCases(connection.endpoint);
  await mkdir(RUNTIME_DIR, { recursive: true });
  const tempFile = path.join(RUNTIME_DIR, `didban-cases-${id}-${randomUUID()}.tmp`);
  await writeFile(tempFile, JSON.stringify(docs), "utf8");
  await rename(tempFile, indexPath(id));
  docsByConnection.set(id, docs);

  const updated: DatabaseConnection = {
    ...connection,
    syncedAt: new Date().toISOString(),
    syncedCases: docs.length,
  };
  await writeConnections(connections.map((item) => (item.id === id ? updated : item)));
  return updated;
}

export async function setDatabaseConnectionEnabled(
  id: string,
  enabled: boolean,
): Promise<DatabaseConnection> {
  const connections = await readConnections();
  const current = getConnectionOrThrow(connections, id);
  if (enabled) {
    await syncDatabaseConnection(id);
  }
  const latest = await readConnections();
  const target = getConnectionOrThrow(latest, id);
  const updated = { ...target, enabled };
  await writeConnections(latest.map((item) => (item.id === id ? updated : item)));
  return updated;
}

export async function loadEnabledDatabaseDocs(): Promise<KnowledgeDoc[]> {
  const connections = await readConnections();
  const enabled = connections.filter((connection) => connection.enabled);
  const indexes = await Promise.all(
    enabled.map(async (connection) => {
      try {
        let docs = docsByConnection.get(connection.id);
        if (!docs) {
          const raw = await readFile(indexPath(connection.id), "utf8");
          const parsed: unknown = JSON.parse(raw);
          if (!Array.isArray(parsed)) {
            throw new Error(`Invalid synced index for database connection ${connection.name}.`);
          }
          docs = parsed as KnowledgeDoc[];
          docsByConnection.set(connection.id, docs);
        }
        return docs;
      } catch (error) {
        if (isMissingFile(error)) {
          throw new Error(`Database connection "${connection.name}" is enabled but not synced.`);
        }
        throw error;
      }
    }),
  );
  return indexes.flat();
}
