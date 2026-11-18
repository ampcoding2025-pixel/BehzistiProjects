import { NextResponse } from "next/server";
import { setDbUserAdmin } from "@/lib/auth/db-users";
import { canManageAdmins } from "@/lib/auth/users";
import { forbidden, getSessionUser, unauthorized } from "@/lib/auth/http";

/** POST { username, isAdmin } — promote/demote DB administrator (lab only). */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!canManageAdmins(user.role)) {
    return forbidden("فقط ادمین می‌تواند ادمین دیگر اضافه کند");
  }

  const body = (await req.json().catch(() => null)) as {
    username?: string;
    isAdmin?: boolean;
  } | null;

  const username = String(body?.username || "").trim();
  if (!username) {
    return NextResponse.json({ ok: false, message: "نام کاربری لازم است" }, { status: 400 });
  }
  if (username === user.username && body?.isAdmin === false) {
    return NextResponse.json(
      { ok: false, message: "نمی‌توانید دسترسی ادمین خودتان را بردارید" },
      { status: 400 },
    );
  }

  try {
    const result = await setDbUserAdmin(username, !!body?.isAdmin);
    return NextResponse.json({ ...result, by: user.username });
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
