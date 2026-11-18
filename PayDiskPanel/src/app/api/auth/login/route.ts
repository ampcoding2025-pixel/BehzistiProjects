import { NextResponse } from "next/server";
import { authenticateDbUser } from "@/lib/auth/db-users";
import {
  findAllowlistEntry,
  findUser,
  isLoginAllowed,
  normalizeLoginId,
} from "@/lib/auth/users";
import { encodeSession, SESSION_COOKIE } from "@/lib/auth/session";

const NO_ACCESS_FA = "شما حق دسترسی ندارید";
const BAD_CREDS_FA = "نام کاربری یا رمز عبور نادرست است";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    username?: string;
    password?: string;
  } | null;

  if (!body?.username || !body?.password) {
    return NextResponse.json(
      { ok: false, message: "نام کاربری و رمز لازم است" },
      { status: 400 },
    );
  }

  const username = normalizeLoginId(body.username);
  const password = body.password.trim();

  // Strict allowlist: unknown usernames never reach DB auth.
  if (!isLoginAllowed(username)) {
    return NextResponse.json(
      { ok: false, message: NO_ACCESS_FA },
      { status: 403 },
    );
  }

  // Local bypass (e.g. set2360141422) — no DB membership required.
  let user = findUser(username, password);

  if (!user) {
    const entry = findAllowlistEntry(username);
    // Local-bypass accounts must not fall through to DB with wrong password
    // and accidentally succeed if a same-named DB user exists.
    if (entry?.localBypass) {
      return NextResponse.json(
        { ok: false, message: BAD_CREDS_FA },
        { status: 401 },
      );
    }

    try {
      const db = await authenticateDbUser(username, password);
      if (db) {
        user = {
          username: db.username,
          password: "",
          displayName: entry?.displayName || db.displayName,
          role: entry?.role || db.role,
        };
      }
    } catch {
      /* DB unreachable */
    }
  }

  if (!user) {
    return NextResponse.json(
      { ok: false, message: BAD_CREDS_FA },
      { status: 401 },
    );
  }

  const token = await encodeSession({
    username: user.username,
    displayName: user.displayName,
    role: user.role,
  });

  const res = NextResponse.json({
    ok: true,
    user: {
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    },
  });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}
