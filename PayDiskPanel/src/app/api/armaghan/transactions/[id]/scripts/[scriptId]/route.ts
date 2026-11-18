import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/auth/http";
import { getTxnScript, runTxnScript } from "@/lib/reports/txn-scripts";
import { getDbTarget } from "@/lib/db/pool";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string; scriptId: string }> },
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id: rawId, scriptId } = await ctx.params;
  const id = Number(rawId);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ ok: false, message: "شناسه نامعتبر" }, { status: 400 });
  }

  const def = getTxnScript(scriptId);
  if (!def) {
    return NextResponse.json({ ok: false, message: "اسکریپت سند یافت نشد" }, { status: 404 });
  }

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") || def.defaultLimit);
  const page = Number(url.searchParams.get("page") || 1);
  const pageSize = Number(
    url.searchParams.get("pageSize") || limit || def.defaultLimit,
  );
  // Optional override TrId for mostamari scripts run from this page
  const trOverride = Number(url.searchParams.get("trId") || id);

  try {
    const result = await runTxnScript(scriptId, {
      trId: def.needsTrId ? trOverride : undefined,
      limit,
      page,
      pageSize,
    });
    return NextResponse.json({
      ok: true,
      db: getDbTarget(),
      ...result,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
