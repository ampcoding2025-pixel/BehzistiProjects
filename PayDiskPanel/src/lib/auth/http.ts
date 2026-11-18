import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { decodeSession, SESSION_COOKIE, type SessionUser } from "./session";

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  return decodeSession(jar.get(SESSION_COOKIE)?.value);
}

export function unauthorized(message = "Unauthorized") {
  return NextResponse.json({ ok: false, message }, { status: 401 });
}

export function forbidden(message = "Forbidden") {
  return NextResponse.json({ ok: false, message }, { status: 403 });
}
