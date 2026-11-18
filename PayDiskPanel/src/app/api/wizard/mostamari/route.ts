import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/auth/http";
import { compareMostamariCalculation } from "@/lib/armaghan/mostamari-compare";
import {
  getMostamariTransaction,
  labApproveMostamari,
  labCalculateMostamari,
  labCreateMostamariTransaction,
  mostamariIbnDuplicates,
  mostamariMissingIbn,
  mostamariPairDiff,
  mostamariPaymentList,
  mostamariPaymentListCount,
  mostamariReview,
} from "@/lib/lab/mostamari-writes";
import { labWritesEnabled } from "@/lib/lab/writes";
import {
  ensureActiveTarget,
  getActiveDbLabel,
  getDbMode,
  getDbTarget,
  isLabDb,
} from "@/lib/db/pool";
import {
  MOSTAMARI_TYPES,
  pipelineForType,
  type MostamariTypeId,
} from "@/lib/mostamari/types";

function meta() {
  return {
    labWrites: labWritesEnabled(),
    dbLabel: getActiveDbLabel(),
    db: getDbTarget(),
    mode: getDbMode(),
  };
}

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  await ensureActiveTarget();
  const url = new URL(req.url);
  const trId = Number(url.searchParams.get("trId") || 0);
  const action = (url.searchParams.get("action") || "").toLowerCase();

  try {
    if (action === "pipeline") {
      const typeId = (url.searchParams.get("typeId") || "") as MostamariTypeId;
      return NextResponse.json({
        ok: true,
        ...meta(),
        types: MOSTAMARI_TYPES,
        pipeline: pipelineForType(typeId || null),
      });
    }

    if (action === "ibn-dup") {
      const data = await mostamariIbnDuplicates(
        Number(url.searchParams.get("limit") || 50),
      );
      return NextResponse.json({ ...data, ...meta(), ok: true });
    }

    if (trId > 0 && action === "review") {
      const data = await mostamariReview(trId, {
        page: Number(url.searchParams.get("page") || 1),
        pageSize: Number(url.searchParams.get("pageSize") || 10),
        includeAlive: url.searchParams.get("alive") === "1",
        includeSample: url.searchParams.get("sample") === "1",
      });
      return NextResponse.json({ ...data, ...meta(), ok: true });
    }

    if (trId > 0 && action === "list") {
      const data = await mostamariPaymentList(trId, {
        page: Number(url.searchParams.get("page") || 1),
        pageSize: Number(url.searchParams.get("pageSize") || 10),
      });
      return NextResponse.json({ ...data, ...meta(), ok: true });
    }

    if (trId > 0 && action === "list-count") {
      const data = await mostamariPaymentListCount(trId);
      return NextResponse.json({ ...data, ...meta(), ok: true });
    }

    if (trId > 0 && action === "compare") {
      const data = await compareMostamariCalculation(trId);
      return NextResponse.json({ ...data, ...meta(), ok: true });
    }

    if (trId > 0 && action === "pair-diff") {
      const peer = Number(url.searchParams.get("peerTrId") || 0);
      const data = await mostamariPairDiff(
        trId,
        peer,
        Number(url.searchParams.get("limit") || 30),
      );
      return NextResponse.json({ ...data, ...meta(), ok: true });
    }

    if (trId > 0 && action === "missing-ibn") {
      const data = await mostamariMissingIbn(
        trId,
        Number(url.searchParams.get("limit") || 40),
      );
      return NextResponse.json({ ...data, ...meta(), ok: true });
    }

    if (trId > 0) {
      const data = await getMostamariTransaction(trId);
      const typeId = (data.header.typeId ||
        url.searchParams.get("typeId") ||
        "") as MostamariTypeId | "";
      return NextResponse.json({
        ...data,
        ...meta(),
        types: MOSTAMARI_TYPES,
        pipeline: pipelineForType(typeId || null),
        ok: true,
      });
    }

    return NextResponse.json({
      ok: true,
      ...meta(),
      types: MOSTAMARI_TYPES,
      note: isLabDb()
        ? "lab — calculate & approve allowed"
        : "read-only — switch to lab for writes",
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  await ensureActiveTarget();

  if (!labWritesEnabled()) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "نوشتن/محاسبه مستمری روی این دیتابیس فعال نیست — lab یا تولید (155) با دسترسی نوشتن",
      },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => null)) as {
    action?: string;
    trId?: number;
    typeId?: string;
    title?: string;
    date?: string;
    description?: string;
    yearMonth?: string;
    cancelled?: boolean;
  } | null;

  const action = String(body?.action || "").toLowerCase();

  try {
    if (action === "create") {
      const typeId = body?.typeId as MostamariTypeId | undefined;
      const result = await labCreateMostamariTransaction({
        title: String(body?.title || ""),
        date: String(body?.date || ""),
        description: body?.description || null,
        username: user.username,
        typeId: typeId || null,
      });
      return NextResponse.json({ ...result, ok: true });
    }

    if (action === "calculate") {
      const trId = Number(body?.trId || 0);
      const typeId = body?.typeId as MostamariTypeId;
      const result = await labCalculateMostamari(trId, typeId);
      return NextResponse.json({ ...result, ok: true });
    }

    if (action === "approve" || action === "cancel") {
      const result = await labApproveMostamari({
        trId: Number(body?.trId || 0),
        typeId: (action === "cancel"
          ? "cancelled"
          : body?.typeId) as MostamariTypeId | "cancelled",
        yearMonth: String(body?.yearMonth || ""),
        username: user.username,
        cancelled: action === "cancel" || !!body?.cancelled,
      });
      return NextResponse.json({ ...result, ok: true });
    }

    return NextResponse.json(
      {
        ok: false,
        message: "Invalid action — create | calculate | approve | cancel",
      },
      { status: 400 },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
