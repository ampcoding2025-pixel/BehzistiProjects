import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/auth/http";
import { searchDbUsers } from "@/lib/auth/db-users";
import { getDbTarget } from "@/lib/db/pool";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const url = new URL(req.url);
  const q = url.searchParams.get("q") || "";
  const limit = Number(url.searchParams.get("limit") || 25);

  try {
    const users = await searchDbUsers(q, limit);
    return NextResponse.json({
      ok: true,
      db: getDbTarget(),
      q,
      users,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message: err instanceof Error ? err.message : String(err),
        db: getDbTarget(),
        users: [],
      },
      { status: 500 },
    );
  }
}
