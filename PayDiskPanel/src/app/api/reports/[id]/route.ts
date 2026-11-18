import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/auth/http";
import { getReport } from "@/lib/reports/catalog";
import { runReport } from "@/lib/reports/run";
import { getDbTarget } from "@/lib/db/pool";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await ctx.params;
  const def = getReport(id);
  if (!def) {
    return NextResponse.json({ ok: false, message: "گزارش یافت نشد" }, { status: 404 });
  }

  const url = new URL(req.url);
  const params: Record<string, string | undefined> = {};
  for (const p of def.params) {
    params[p.key] = url.searchParams.get(p.key) || undefined;
  }
  // also accept common extras
  params.from = url.searchParams.get("from") || params.from;
  params.to = url.searchParams.get("to") || params.to;
  params.limit = url.searchParams.get("limit") || params.limit;

  for (const p of def.params) {
    if (p.required && !params[p.key]) {
      return NextResponse.json(
        { ok: false, message: `پارامتر الزامی: ${p.label}` },
        { status: 400 },
      );
    }
  }

  try {
    const result = await runReport(id, params);
    return NextResponse.json({
      ok: true,
      db: getDbTarget(),
      report: def,
      result,
      note: "فقط SELECT — هیچ UPDATE/DELETE/EXEC انجام نشد",
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message: err instanceof Error ? err.message : String(err),
        db: getDbTarget(),
      },
      { status: 500 },
    );
  }
}
