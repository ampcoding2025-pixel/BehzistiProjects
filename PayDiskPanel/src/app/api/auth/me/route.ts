import { NextResponse } from "next/server";
import {
  canSeeSettings,
  canSeeTransactions,
  getEffectiveAccess,
} from "@/lib/auth/access";
import { getSessionUser } from "@/lib/auth/http";
import { isLiveMode } from "@/lib/worker/whitelist";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, user: null }, { status: 401 });
  const access = await getEffectiveAccess(user.username, user.role);
  return NextResponse.json({
    ok: true,
    user,
    access: {
      allowedSupplyIds: access.allowedSupplyIds,
      allowedMostamariIds: access.allowedMostamariIds,
      canCreate: access.canCreate,
      canApprove: access.canApprove,
      canSeeSettings: canSeeSettings(user.role),
      canSeeTransactions: canSeeTransactions(access),
    },
    workerMode: isLiveMode() ? "LIVE" : "dry-run",
  });
}
