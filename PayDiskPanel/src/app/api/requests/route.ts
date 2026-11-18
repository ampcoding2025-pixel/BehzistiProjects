import { NextResponse } from "next/server";
import { canCreateRequest } from "@/lib/auth/users";
import { forbidden, getSessionUser, unauthorized } from "@/lib/auth/http";
import { getDiskType } from "@/lib/catalog";
import {
  listRequests,
  listRequestsPage,
  nextRequestId,
  nowLabel,
  upsertRequest,
} from "@/lib/store/requests";
import type { DiskRequest } from "@/lib/types";
import { runDiskJob } from "@/lib/worker/run";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const url = new URL(req.url);
  const page = Number(url.searchParams.get("page") || 1);
  const pageSize = Number(url.searchParams.get("pageSize") || 8);
  const q = url.searchParams.get("q") || "";
  const result = await listRequestsPage({ page, pageSize, q });

  return NextResponse.json({ ok: true, ...result });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!canCreateRequest(user.role)) return forbidden("ناظر مالی اجازه ثبت درخواست ندارد");

  const body = (await req.json().catch(() => null)) as {
    diskTypeId?: string;
    title?: string;
    periodLabel?: string;
    armaghanTransactionId?: number | string;
    makeOverType?: DiskRequest["makeOverType"];
    supplyLocationId?: number;
    runNow?: boolean;
    /** Create only; pipeline steps run separately (Armaghan-style wizard). */
    pipeline?: boolean;
  } | null;

  if (!body?.diskTypeId || !body?.title || !body?.periodLabel) {
    return NextResponse.json({ ok: false, message: "فیلدهای الزامی ناقص است" }, { status: 400 });
  }

  const disk = getDiskType(body.diskTypeId);
  if (!disk) {
    return NextResponse.json({ ok: false, message: "نوع دیسکت نامعتبر" }, { status: 400 });
  }

  const existing = await listRequests();
  let row: DiskRequest = {
    id: nextRequestId(existing),
    diskTypeId: body.diskTypeId,
    title: body.title.trim(),
    periodLabel: body.periodLabel.trim(),
    requestedBy: user.displayName,
    requestedAt: nowLabel(),
    status: "queued",
    pipelineStage: "draft",
    makeOverType: body.makeOverType || disk.makeOverType,
    supplyLocationId:
      typeof body.supplyLocationId === "number"
        ? body.supplyLocationId
        : disk.supplyLocationIds?.[0],
    armaghanTransactionId: body.armaghanTransactionId
      ? Number(body.armaghanTransactionId)
      : undefined,
    logTail: [`${new Date().toISOString()} created by ${user.username}`],
  };

  if (body.pipeline) {
    // Wizard will call /pipeline for each Armaghan-equivalent step.
  } else if (body.runNow !== false) {
    row = await runDiskJob(row);
  }

  await upsertRequest(row);
  return NextResponse.json({ ok: true, request: row });
}
