import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/auth/http";
import { REPORTS } from "@/lib/reports/catalog";
import { getDbTarget } from "@/lib/db/pool";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  return NextResponse.json({
    ok: true,
    db: getDbTarget(),
    mode: "read-only",
    reports: REPORTS,
  });
}
