import { NextResponse } from "next/server";
import { canRunWorker } from "@/lib/auth/users";
import { forbidden, getSessionUser, unauthorized } from "@/lib/auth/http";
import { getRequest, upsertRequest } from "@/lib/store/requests";
import { runDiskJob } from "@/lib/worker/run";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!canRunWorker(user.role)) return forbidden("اجرای Worker برای این نقش مجاز نیست");

  const { id } = await ctx.params;
  const existing = await getRequest(id);
  if (!existing) {
    return NextResponse.json({ ok: false, message: "درخواست یافت نشد" }, { status: 404 });
  }

  existing.logTail = [
    ...(existing.logTail ?? []),
    `${new Date().toISOString()} re-run by ${user.username}`,
  ];
  const updated = await runDiskJob(existing);
  await upsertRequest(updated);
  return NextResponse.json({ ok: true, request: updated });
}
