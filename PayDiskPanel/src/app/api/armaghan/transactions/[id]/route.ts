import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/auth/http";
import { getArmaghanTransactionDetail } from "@/lib/armaghan/inspect";
import { getDbTarget } from "@/lib/db/pool";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id: raw } = await ctx.params;
  const id = Number(raw);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ ok: false, message: "شناسه نامعتبر" }, { status: 400 });
  }

  const url = new URL(req.url);
  const samplePage = Number(url.searchParams.get("samplePage") || 1);
  const samplePageSize = Number(url.searchParams.get("samplePageSize") || 15);

  try {
    const detail = await getArmaghanTransactionDetail(id, {
      samplePage,
      samplePageSize,
    });
    if (!detail) {
      return NextResponse.json({ ok: false, message: "تراکنش یافت نشد" }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      db: getDbTarget(),
      detail,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
