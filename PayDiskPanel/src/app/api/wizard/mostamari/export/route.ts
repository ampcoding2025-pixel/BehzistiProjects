import { getSessionUser, unauthorized } from "@/lib/auth/http";
import {
  iterateMostamariPayListExport,
  mostamariExportFilename,
  mostamariExportMime,
  parseMostamariExportIbnScope,
  type MostamariExportFormat,
  MOSTAMARI_EXPORT_FORMATS,
} from "@/lib/lab/mostamari-export";

export const runtime = "nodejs";
/** Long exports (large PayedContinusPayment) — allow extended streaming. */
export const maxDuration = 300;

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const url = new URL(req.url);
  const trId = Number(url.searchParams.get("trId") || 0);
  const formatRaw = (url.searchParams.get("format") || "csv-excel").toLowerCase();
  const format = (
    MOSTAMARI_EXPORT_FORMATS.some((f) => f.id === formatRaw)
      ? formatRaw
      : "csv-excel"
  ) as MostamariExportFormat;
  const ibnScope = parseMostamariExportIbnScope(url.searchParams.get("ibn"));

  if (!Number.isFinite(trId) || trId <= 0) {
    return new Response(JSON.stringify({ ok: false, message: "trId نامعتبر" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const filename = mostamariExportFilename(trId, format, ibnScope);
  const mime = mostamariExportMime(format);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of iterateMostamariPayListExport(
          trId,
          format,
          ibnScope,
        )) {
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
      "Content-Type": mime,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
