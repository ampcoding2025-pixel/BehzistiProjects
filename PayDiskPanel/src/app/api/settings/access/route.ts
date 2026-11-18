import { NextResponse } from "next/server";
import { forbidden, getSessionUser, unauthorized } from "@/lib/auth/http";
import {
  catalogTypeOptions,
  readAccessFile,
  writeAccessFile,
  type UserSupplyAccess,
} from "@/lib/auth/access";
import { resolveDbUserDisplayNames } from "@/lib/auth/db-users";
import type { DiskFamily } from "@/lib/types";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const url = new URL(req.url);
  const family = (url.searchParams.get("family") || "yarane") as DiskFamily;
  const typeQ = url.searchParams.get("typeQ") || "";

  const file = await readAccessFile();

  const canEdit = user.role === "admin";

  let users = file.users;
  try {
    const names = await resolveDbUserDisplayNames(
      file.users.map((u) => u.username),
    );
    users = file.users.map((u) => {
      const fromDb = names[u.username.toLowerCase()];
      const stored = (u.displayName || "").trim();
      const looksLikeUsername =
        !stored || stored.toLowerCase() === u.username.toLowerCase();
      return {
        ...u,
        displayName: fromDb || (!looksLikeUsername ? stored : u.username),
      };
    });
  } catch {
    // keep file displayName if DB name lookup fails
  }

  return NextResponse.json({
    ok: true,
    canEdit,
    canManageAdmins: user.role === "admin",
    enforced: file.enforced,
    users,
    typeOptions: catalogTypeOptions(
      family === "mostamari" ? "mostamari" : "yarane",
      typeQ,
    ),
    family: family === "mostamari" ? "mostamari" : "yarane",
  });
}

export async function PUT(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "admin") {
    return forbidden("فقط ادمین می‌تواند دسترسی را تغییر دهد");
  }

  const body = (await req.json().catch(() => null)) as {
    enforced?: boolean;
    users?: UserSupplyAccess[];
  } | null;

  if (!body || !Array.isArray(body.users)) {
    return NextResponse.json({ ok: false, message: "بدنه نامعتبر" }, { status: 400 });
  }

  const users = body.users
    .filter((u) => String(u.username || "").trim())
    .map((u) => ({
      username: String(u.username).trim(),
      dbUserId: u.dbUserId ?? null,
      displayName: u.displayName,
      typeRefs: Array.isArray(u.typeRefs) ? u.typeRefs : [],
      canCreate: !!u.canCreate,
      canApprove: !!u.canApprove,
    }));

  const saved = await writeAccessFile({
    enforced: body.enforced !== false,
    users,
  });

  return NextResponse.json({ ok: true, enforced: saved.enforced, users: saved.users });
}
