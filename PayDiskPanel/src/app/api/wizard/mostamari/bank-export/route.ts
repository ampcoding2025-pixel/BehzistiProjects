import { getSessionUser, unauthorized } from "@/lib/auth/http";
import {
  iterateMostamariBankDiskette,
  mostamariBankFilename,
} from "@/lib/lab/mostamari-bank-export";
import { labExportMostamariBank } from "@/lib/lab/mostamari-writes";
import { targetAllowsWrites } from "@/lib/db/pool";
import { parseMostamariExportIbnScope } from "@/lib/lab/mostamari-export";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Stream Armaghan-format bank diskette (dbo.Export record layout). */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const url = new URL(req.url);
  const trId = Number(url.searchParams.get("trId") || 0);
  const ibnScope = parseMostamariExportIbnScope(url.searchParams.get("ibn"));
  if (!Number.isFinite(trId) || trId <= 0) {
    return new Response(JSON.stringify({ ok: false, message: "trId نامعتبر" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const filename = mostamariBankFilename(trId, ibnScope);
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of iterateMostamariBankDiskette(trId, ibnScope)) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        try {
          controller.enqueue(encoder.encode(`\r\n# ERROR: ${msg}\r\n`));
        } catch {
          /* ignore */
        }
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=us-ascii",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-PayDisk-Bank-Format": "armaghan-dbo-Export",
    },
  });
}

/**
 * Write bank diskette to Armaghan Diskette share + set FileName
 * (UNC first, then EXEC dbo.Export). Lab / writable DB only.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  if (!targetAllowsWrites()) {
    return Response.json(
      {
        ok: false,
        message:
          "نوشتن دیسکت بانک روی هدف فعلی مجاز نیست — lab یا تولید با دسترسی نوشتن",
      },
      { status: 403 },
    );
  }

  let body: { trId?: number; fileName?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* empty */
  }
  const trId = Number(body.trId || 0);
  if (!Number.isFinite(trId) || trId <= 0) {
    return Response.json({ ok: false, message: "trId نامعتبر" }, { status: 400 });
  }

  try {
    const result = await labExportMostamariBank(trId, body.fileName);
    return Response.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, message: msg }, { status: 500 });
  }
}
