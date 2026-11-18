import { NextResponse, type NextRequest } from "next/server";
import { decodeSession, SESSION_COOKIE } from "@/lib/auth/session";

const PUBLIC = ["/login", "/api/auth/login"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.match(/\.(png|jpg|svg|ico)$/)
  ) {
    return NextResponse.next();
  }

  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const user = await decodeSession(token);

  if (!user && !isPublic) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
