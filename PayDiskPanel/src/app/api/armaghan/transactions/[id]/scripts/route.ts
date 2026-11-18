import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/auth/http";
import { getArmaghanTransactionDetail } from "@/lib/armaghan/inspect";
import {
  scriptsForFamily,
  suggestYaraneType,
} from "@/lib/reports/txn-scripts";
import { ACTIVE_SUPPLY_LOCATIONS } from "@/lib/supply-locations";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const id = Number((await ctx.params).id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ ok: false, message: "شناسه نامعتبر" }, { status: 400 });
  }

  try {
    const detail = await getArmaghanTransactionDetail(id);
    if (!detail) {
      return NextResponse.json({ ok: false, message: "تراکنش یافت نشد" }, { status: 404 });
    }

    const primarySupply = detail.supplies[0]?.Id
      ? Number(detail.supplies[0].Id)
      : detail.header.DefinitionSupplyLocationId != null
        ? Number(detail.header.DefinitionSupplyLocationId)
        : null;
    const suggested = suggestYaraneType(primarySupply);

    return NextResponse.json({
      ok: true,
      readonly: true,
      transactionId: id,
      family: "yarane",
      suggestedType: suggested,
      disketteTypes: ACTIVE_SUPPLY_LOCATIONS.map((s) => ({
        id: s.id,
        titleFa: s.titleFa,
        keyword: s.keyword,
      })),
      scripts: scriptsForFamily("yarane").map((s) => ({
        id: s.id,
        titleFa: s.titleFa,
        description: s.description,
        managerWhy: s.managerWhy,
        defaultLimit: s.defaultLimit,
      })),
      mostamariScripts: scriptsForFamily("mostamari").map((s) => ({
        id: s.id,
        titleFa: s.titleFa,
        description: s.description,
        managerWhy: s.managerWhy,
        defaultLimit: s.defaultLimit,
        note: "برای تراکنش‌های PayedTransaction (مستمری)؛ روی MakeOver معمولاً خالی است",
      })),
      doc: "docs/19-ops-doc-scripts-readonly.md",
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
