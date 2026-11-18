import { NextResponse } from "next/server";
import { canRunWorker } from "@/lib/auth/users";
import { forbidden, getSessionUser, unauthorized } from "@/lib/auth/http";
import { getRequest, upsertRequest } from "@/lib/store/requests";
import { runPipelineAction, type PipelineAction } from "@/lib/worker/pipeline";

const ACTIONS = new Set<PipelineAction>([
  "register",
  "calculate",
  "list",
  "excel",
  "diskette",
  "handoff_finance",
  "mark_ready",
]);

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!canRunWorker(user.role)) return forbidden("اجرای مراحل برای این نقش مجاز نیست");

  const { id } = await ctx.params;
  const existing = await getRequest(id);
  if (!existing) {
    return NextResponse.json({ ok: false, message: "درخواست یافت نشد" }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as {
    action?: string;
    makeOverType?: DiskRequestPatch["makeOverType"];
    supplyLocationId?: number;
    diskTypeId?: string;
  } | null;

  if (!body) {
    return NextResponse.json({ ok: false, message: "بدنه درخواست نامعتبر" }, { status: 400 });
  }

  const action = body.action as PipelineAction | undefined;
  if (!action || !ACTIONS.has(action)) {
    return NextResponse.json({ ok: false, message: "action نامعتبر" }, { status: 400 });
  }

  if (body.diskTypeId) existing.diskTypeId = body.diskTypeId;
  if (body.makeOverType) existing.makeOverType = body.makeOverType;
  if (typeof body.supplyLocationId === "number") {
    existing.supplyLocationId = body.supplyLocationId;
  }

  existing.logTail = [
    ...(existing.logTail ?? []),
    `${new Date().toISOString()} pipeline:${action} by ${user.username}`,
  ];

  const updated = await runPipelineAction(existing, action);
  await upsertRequest(updated);
  return NextResponse.json({ ok: true, request: updated });
}

type DiskRequestPatch = import("@/lib/types").DiskRequest;
