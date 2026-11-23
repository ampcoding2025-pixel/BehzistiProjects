import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/auth/http";
import { ensureActiveTarget, getActiveDbLabel } from "@/lib/db/pool";
import {
  loadMostamariIbnCandidates,
  loadMostamariPayCandidates,
  loadYaraneCenterCandidates,
} from "@/lib/sayah/candidates";
import {
  customerHasShebaId,
  customerHasShebaIdBatch,
  getSayahMode,
  isSayahTatbighConfigured,
  normalizeNationalId,
  normalizeShebaId,
  sayahTransportStatus,
  type SayahAccountOwnerType,
  type SayahMatchRequest,
  type SayahMode,
} from "@/lib/sayah/tatbigh";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  return NextResponse.json({
    ok: true,
    ...sayahTransportStatus(),
    configured: isSayahTatbighConfigured(),
    dbLabel: getActiveDbLabel(),
  });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  if (!isSayahTatbighConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "سرویس سیاح پیکربندی نشده — PAYDISK_SAYAH_* را در env تنظیم کنید",
      },
      { status: 503 },
    );
  }

  await ensureActiveTarget();
  const body = (await req.json().catch(() => null)) as {
    action?: string;
    /** mostamari-ibn | mostamari-pay | yarane-center | single */
    scope?: string;
    trId?: number;
    limit?: number;
    delayMs?: number;
    concurrency?: number;
    nationalId?: string;
    shebaId?: string;
    legalId?: string;
    accountOwnerType?: string;
    /** auto | rest | soap — override PAYDISK_SAYAH_MODE for this call */
    mode?: string;
  } | null;

  const action = String(body?.action || "batch").toLowerCase();
  const limit = Math.min(100, Math.max(1, Number(body?.limit) || 20));
  const delayMs = Math.min(2000, Math.max(0, Number(body?.delayMs) || 40));
  const concurrency = Math.min(
    8,
    Math.max(1, Number(body?.concurrency) || 4),
  );
  const modeRaw = String(body?.mode || getSayahMode()).toLowerCase();
  const mode: SayahMode =
    modeRaw === "rest" || modeRaw === "soap" || modeRaw === "auto"
      ? modeRaw
      : "auto";

  try {
    if (action === "single" || body?.scope === "single") {
      const accountOwnerType = (String(
        body?.accountOwnerType || "1",
      ) || "1") as SayahAccountOwnerType;
      const reqBody: SayahMatchRequest = {
        accountOwnerType,
        nationalId: String(body?.nationalId || ""),
        legalId: String(body?.legalId || "0"),
        shebaId: String(body?.shebaId || ""),
      };
      if (
        accountOwnerType === "1" &&
        !normalizeNationalId(reqBody.nationalId)
      ) {
        return NextResponse.json(
          { ok: false, message: "کد ملی نامعتبر (۱۰ رقم)" },
          { status: 400 },
        );
      }
      if (!normalizeShebaId(reqBody.shebaId)) {
        return NextResponse.json(
          { ok: false, message: "شبا نامعتبر (IR + ۲۴ رقم)" },
          { status: 400 },
        );
      }
      const result = await customerHasShebaId(reqBody, { mode });
      return NextResponse.json({
        ok: result.ok,
        matched: result.matched,
        mode,
        transport: result.transport,
        tried: result.tried,
        result,
        dbLabel: getActiveDbLabel(),
      });
    }

    const scope = String(body?.scope || "mostamari-ibn").toLowerCase();
    let loaded: Awaited<ReturnType<typeof loadMostamariIbnCandidates>>;

    if (scope === "mostamari-pay") {
      const trId = Number(body?.trId || 0);
      if (!trId) {
        return NextResponse.json(
          { ok: false, message: "trId برای mostamari-pay لازم است" },
          { status: 400 },
        );
      }
      loaded = await loadMostamariPayCandidates(trId, limit);
    } else if (scope === "yarane-center") {
      loaded = await loadYaraneCenterCandidates(limit);
    } else {
      loaded = await loadMostamariIbnCandidates(limit);
    }

    if (loaded.candidates.length === 0) {
      return NextResponse.json({
        ok: true,
        scope,
        checked: 0,
        matchCount: 0,
        mismatchCount: 0,
        errorCount: 0,
        totalEligible: loaded.totalEligible,
        rows: [],
        mismatches: [],
        errors: [],
        message:
          loaded.totalEligible === 0
            ? "ردیفی با کد ملی و شبا برای تطبیق یافت نشد"
            : "نمونه قابل ارسال به سیاح نبود (فرمت شبا/کد ملی)",
        dbLabel: getActiveDbLabel(),
        gateOk: true,
      });
    }

    const batch = await customerHasShebaIdBatch(loaded.candidates, {
      limit,
      delayMs,
      concurrency,
      timeoutMs: 20_000,
      mode,
    });

    const gateOk = batch.mismatchCount === 0 && batch.errorCount === 0;
    const via =
      batch.transports.length > 0
        ? ` · ${batch.transports.join("+")}`
        : "";

    return NextResponse.json({
      ok: true,
      scope,
      mode,
      totalEligible: loaded.totalEligible,
      ...batch,
      gateOk,
      message: gateOk
        ? `تطبیق موفق: ${batch.matchCount.toLocaleString("fa-IR")} از ${batch.checked.toLocaleString("fa-IR")}${via}`
        : batch.mismatchCount > 0
          ? `${batch.mismatchCount.toLocaleString("fa-IR")} عدم تطبیق شبا↔کد ملی — قبل از محاسبه رفع کنید`
          : `${batch.errorCount.toLocaleString("fa-IR")} خطا از سرویس سیاح — دوباره تلاش کنید`,
      dbLabel: getActiveDbLabel(),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
