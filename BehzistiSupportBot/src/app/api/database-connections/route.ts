import { NextResponse } from "next/server";
import { invalidateKnowledgeCache } from "@/lib/knowledge";
import {
  addDatabaseConnection,
  getConfiguredDatabaseEndpoint,
  listDatabaseConnectionStatuses,
  removeDatabaseConnection,
  setDatabaseConnectionEnabled,
  syncDatabaseConnection,
  testDatabaseEndpoint,
  updateDatabaseConnection,
} from "@/lib/didban-sources";

export const runtime = "nodejs";
export const maxDuration = 900;

export async function GET() {
  try {
    return NextResponse.json({
      configuredEndpoint: getConfiguredDatabaseEndpoint(),
      connections: await listDatabaseConnectionStatuses(),
    });
  } catch (error) {
    console.error("[database connections]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load database connections." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    const value: unknown = await request.json();
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    body = value as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  try {
    if (body.action === "test") {
      await testDatabaseEndpoint(body.endpoint);
      return NextResponse.json({ connected: true });
    }
    if (body.action === "add") {
      const connection = await addDatabaseConnection({
        name: body.name,
        endpoint: body.endpoint,
      });
      invalidateKnowledgeCache();
      return NextResponse.json({ connection }, { status: 201 });
    }
    if (body.action === "update" && typeof body.id === "string") {
      const connection = await updateDatabaseConnection({
        id: body.id,
        name: body.name,
        endpoint: body.endpoint,
      });
      invalidateKnowledgeCache();
      return NextResponse.json({ connection });
    }
    if (body.action === "delete" && typeof body.id === "string") {
      await removeDatabaseConnection(body.id);
      invalidateKnowledgeCache();
      return NextResponse.json({ removed: true });
    }
    if (body.action === "sync" && typeof body.id === "string") {
      const connection = await syncDatabaseConnection(body.id);
      invalidateKnowledgeCache();
      return NextResponse.json({ connection });
    }
    if (
      body.action === "set-enabled" &&
      typeof body.id === "string" &&
      typeof body.enabled === "boolean"
    ) {
      const connection = await setDatabaseConnectionEnabled(body.id, body.enabled);
      invalidateKnowledgeCache();
      return NextResponse.json({ connection });
    }
    return NextResponse.json({ error: "Unsupported database connection action." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database connection action failed.";
    console.error("[database connection action]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
