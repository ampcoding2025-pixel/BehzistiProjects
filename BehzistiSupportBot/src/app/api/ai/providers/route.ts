import { NextResponse } from "next/server";
import {
  getAiProvider,
  getAiProviderStatuses,
  setAiProvider,
} from "@/lib/ai-provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [provider, statuses] = await Promise.all([
      getAiProvider(),
      getAiProviderStatuses(),
    ]);
    return NextResponse.json({ provider, statuses }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[AI provider settings]", error);
    return NextResponse.json(
      { error: "Could not load AI provider settings." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const provider =
      typeof body === "object" && body !== null && "provider" in body
        ? body.provider
        : undefined;
    if (provider !== "ollama" && provider !== "copilot") {
      return NextResponse.json({ error: "Select a valid AI provider." }, { status: 400 });
    }

    await setAiProvider(provider);
    const statuses = await getAiProviderStatuses();
    return NextResponse.json(
      { provider, statuses },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[AI provider settings]", error);
    return NextResponse.json(
      { error: "Could not save AI provider settings." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
