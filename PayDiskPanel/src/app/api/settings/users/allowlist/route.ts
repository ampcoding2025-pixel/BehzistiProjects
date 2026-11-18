import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/auth/http";
import { lookupDbUsersByUsernames } from "@/lib/auth/db-users";
import { loadUsers } from "@/lib/auth/users";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  try {
    const allowlist = loadUsers();
    const dbHits = await lookupDbUsersByUsernames(
      allowlist.map((u) => u.username),
    );

    const users = allowlist.map((u) => {
      const key = u.username.toLowerCase();
      const db = dbHits[key];
      const authMode = u.localBypass ? ("local" as const) : ("db" as const);
      return {
        username: u.username,
        displayName: db?.displayName || u.displayName || u.username,
        role: u.role,
        authMode,
        authModeFa:
          authMode === "local"
            ? "محلی (بدون نیاز به کاربر دیتابیس)"
            : "رمز از دیتابیس ۱۵۵/۱۵۷",
        dbUserId: db?.dbUserId ?? null,
        dbFound: !!db?.found,
        dbEnabled: !!db?.isEnabled,
        dbSource: db?.source ?? null,
        dbSourceFa:
          db?.source === "prod"
            ? "۱۵۵"
            : db?.source === "replica"
              ? "۱۵۷"
              : null,
        canLogin:
          authMode === "local"
            ? true
            : !!(db?.found && db.isEnabled),
      };
    });

    return NextResponse.json({
      ok: true,
      noteFa:
        "فقط این کاربران می‌توانند وارد پنل شوند. کاربران دیتابیسی باید در ۱۵۵ یا ۱۵۷ فعال باشند؛ ادمین محلی بدون عضویت در DB مجاز است.",
      users,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message: err instanceof Error ? err.message : String(err),
        users: [],
      },
      { status: 500 },
    );
  }
}
