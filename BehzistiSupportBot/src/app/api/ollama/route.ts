import { NextResponse } from "next/server";
import { getOllamaConfig, isOllamaReady } from "@/lib/ollama";

export const runtime = "nodejs";

export async function GET() {
  const config = getOllamaConfig();
  const status = await isOllamaReady(config);
  return NextResponse.json({
    enabled: config.enabled,
    baseUrl: config.baseUrl,
    model: config.model,
    ready: status.ok,
    installedModels: status.models,
    error: status.error ?? null,
  });
}
