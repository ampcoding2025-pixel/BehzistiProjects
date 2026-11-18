import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/auth/http";
import { getTransactionPayedStats } from "@/lib/armaghan/txn-stats";
import { getActiveDbLabel, getDbTarget } from "@/lib/db/pool";

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
  const familyRaw = (url.searchParams.get("family") || "yarane").toLowerCase();
  const family = familyRaw === "mostamari" ? "mostamari" : "yarane";
  const fieldsRaw = (url.searchParams.get("fields") || "all").toLowerCase();
  const fields =
    fieldsRaw === "payedrows"
      ? "payedRows"
      : fieldsRaw === "keys"
        ? "keys"
        : "all";

  try {
    const stats = await getTransactionPayedStats(id, family, fields);
    return NextResponse.json({
      ok: true,
      family,
      db: getDbTarget(),
      dbLabel: getActiveDbLabel(),
      trId: id,
      ...stats,
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
