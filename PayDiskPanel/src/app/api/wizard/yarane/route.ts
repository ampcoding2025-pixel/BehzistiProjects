import { NextResponse } from "next/server";
import {
  canUseSupply,
  filterTypesByAccess,
  getEffectiveAccess,
} from "@/lib/auth/access";
import { canRunWorker } from "@/lib/auth/users";
import { forbidden, getSessionUser, unauthorized } from "@/lib/auth/http";
import { loadYaraneWizardTxn } from "@/lib/armaghan/inspect";
import { compareYaraneCalculation } from "@/lib/armaghan/yarane-compare";
import { ensureActiveTarget, getActiveDbLabel, getDbTarget } from "@/lib/db/pool";
import { isCalcDraftEnabled } from "@/lib/lab/calc-draft";
import {
  labApproveYarane,
  labCalculateYarane,
  labCancelYaraneTransaction,
  labCreateYaraneTransaction,
  labReviewYarane,
  labWritesEnabled,
  labYaranePersonList,
  labYaraneThresholds,
} from "@/lib/lab/writes";
import {
  clearYaraneDeviationCache,
  labYaraneShebaDeviations,
} from "@/lib/sayah/yarane-deviations";
import {
  YARANE_DOC_TYPES,
  YARANE_EXTRA_TYPES,
  inferWizardStep,
  isKnownYaraneSupply,
} from "@/lib/wizard/yarane-types";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  await ensureActiveTarget();
  const url = new URL(req.url);
  const trId = Number(url.searchParams.get("trId") || 0);
  const action = (url.searchParams.get("action") || "").toLowerCase();
  const access = await getEffectiveAccess(user.username, user.role);

  const base = {
    ok: true as const,
    labWrites: labWritesEnabled(),
    calcDraft: isCalcDraftEnabled(),
    db: getDbTarget(),
    dbLabel: getActiveDbLabel(),
    types: filterTypesByAccess(YARANE_DOC_TYPES, access),
    extraTypes: filterTypesByAccess(YARANE_EXTRA_TYPES, access),
    access: {
      role: access.role,
      allowedSupplyIds: access.allowedSupplyIds,
      canCreate: access.canCreate,
      canApprove: access.canApprove,
    },
  };

  if (trId > 0 && action === "compare") {
    try {
      const data = await compareYaraneCalculation(trId);
      return NextResponse.json({ ...data, ...base, ok: true });
    } catch (err) {
      return NextResponse.json(
        {
          ...base,
          ok: false,
          message: err instanceof Error ? err.message : String(err),
        },
        { status: 500 },
      );
    }
  }

  if (!trId) return NextResponse.json(base);

  try {
    // Always light read-pool load (never write-pool review / sample joins on open).
    const t = await loadYaraneWizardTxn(trId);
    if (!t) {
      return NextResponse.json(
        { ...base, ok: false, message: "تراکنش یافت نشد" },
        { status: 404 },
      );
    }

    const step = inferWizardStep({
      payedRows: t.payedRows,
      key2: t.key2,
    });

    return NextResponse.json({
      ...base,
      transaction: {
        trId: t.trId,
        title: t.title,
        date: t.date,
        key2: t.key2,
        key3: t.key3,
        supplyLocationId: t.supplyLocationId,
        payedRows: t.payedRows,
        supplyCount: t.supplyCount,
        subsidySum: t.subsidySum,
        sampleRows: [],
        samplePage: 1,
        sampleTotalPages: 1,
        sampleTotal: t.payedRows,
        supplies: [],
        approved: t.approved,
        step,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        ...base,
        ok: false,
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

type Body = {
  action?: string;
  title?: string;
  date?: string;
  description?: string;
  supplyLocationId?: number;
  trId?: number;
  page?: number;
  pageSize?: number;
  /** person_list: all | with-ibn | without-ibn */
  ibnScope?: string;
  /** review: load sample table (default true) */
  includeSample?: boolean;
  /** sheba_deviations: max centers to check via Sayah */
  sayahLimit?: number;
  /** sheba_deviations: force fresh Sayah (ignore server cache) */
  refreshSayah?: boolean;
};

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!canRunWorker(user.role)) return forbidden("فقط اپراتور/ادمین");

  await ensureActiveTarget();

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    body = {};
  }

  const action = body.action || "";
  const readOnlyActions = new Set([
    "review",
    "person_list",
    "sheba_deviations",
    "thresholds",
    "compare",
  ]);

  if (!labWritesEnabled() && !readOnlyActions.has(action)) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "نوشتن/محاسبه روی این دیتابیس فعال نیست — lab را انتخاب کنید یا روی تولید (155) دسترسی نوشتن را روشن کنید",
      },
      { status: 403 },
    );
  }

  const access = await getEffectiveAccess(user.username, user.role);

  try {
    switch (action) {
      case "create": {
        if (!access.canCreate) {
          return forbidden("ایجاد تراکنش برای این کاربر مجاز نیست");
        }
        const supply = body.supplyLocationId
          ? Number(body.supplyLocationId)
          : 0;
        if (supply && !canUseSupply(access, supply)) {
          return forbidden("این نوع تراکنش برای شما مجاز نیست");
        }
        const result = await labCreateYaraneTransaction({
          title: String(body.title || ""),
          date: String(body.date || ""),
          registrar: user.username,
          description: body.description,
          supplyLocationId: supply || undefined,
        });
        return NextResponse.json({
          ok: true,
          db: getDbTarget(),
          labWrites: labWritesEnabled(),
          by: user.username,
          result,
        });
      }
      case "calculate": {
        const trId = Number(body.trId);
        const supply = Number(body.supplyLocationId);
        if (!isKnownYaraneSupply(supply)) {
          return NextResponse.json(
            { ok: false, message: "کد محل تأمین اعتبار نامعتبر است" },
            { status: 400 },
          );
        }
        if (!canUseSupply(access, supply)) {
          return forbidden("این نوع تراکنش برای شما مجاز نیست");
        }
        const result = await labCalculateYarane(trId, supply);
        clearYaraneDeviationCache(trId);
        return NextResponse.json({
          ok: true,
          db: getDbTarget(),
          labWrites: labWritesEnabled(),
          by: user.username,
          result,
        });
      }
      case "review": {
        const result = await labReviewYarane(Number(body.trId), {
          page: body.page,
          pageSize: body.pageSize ?? 15,
          includeSample: body.includeSample !== false,
        });
        return NextResponse.json({
          ok: true,
          db: getDbTarget(),
          labWrites: labWritesEnabled(),
          result,
        });
      }
      case "sheba_deviations": {
        const page = body.page ?? 1;
        const result = await labYaraneShebaDeviations(Number(body.trId), {
          page,
          pageSize: body.pageSize ?? 5,
          sayahLimit: body.sayahLimit,
          // Page changes reuse cache; explicit button can force refresh.
          refreshSayah:
            typeof body.refreshSayah === "boolean"
              ? body.refreshSayah
              : page === 1,
        });
        return NextResponse.json({
          ok: true,
          db: getDbTarget(),
          labWrites: labWritesEnabled(),
          result,
        });
      }
      case "person_list": {
        const result = await labYaranePersonList(Number(body.trId), {
          page: body.page,
          pageSize: body.pageSize ?? 25,
          ibnScope:
            body.ibnScope === "with-ibn" || body.ibnScope === "without-ibn"
              ? body.ibnScope
              : "all",
        });
        return NextResponse.json({
          ok: true,
          db: getDbTarget(),
          labWrites: labWritesEnabled(),
          result,
        });
      }
      case "thresholds": {
        const supply = Number(body.supplyLocationId);
        if (!isKnownYaraneSupply(supply)) {
          return NextResponse.json(
            { ok: false, message: "کد محل تأمین اعتبار نامعتبر است" },
            { status: 400 },
          );
        }
        if (!canUseSupply(access, supply)) {
          return forbidden("این نوع تراکنش برای شما مجاز نیست");
        }
        const result = await labYaraneThresholds(supply, {
          page: body.page,
          pageSize: body.pageSize ?? 25,
        });
        return NextResponse.json({
          ok: true,
          db: getDbTarget(),
          labWrites: labWritesEnabled(),
          result,
        });
      }
      case "approve": {
        if (!access.canApprove) {
          return forbidden("تایید برای این کاربر مجاز نیست");
        }
        const result = await labApproveYarane(Number(body.trId));
        return NextResponse.json({
          ok: true,
          db: getDbTarget(),
          labWrites: labWritesEnabled(),
          by: user.username,
          result,
        });
      }
      case "cancel": {
        if (!access.canCreate && !access.canApprove) {
          return forbidden("لغو تراکنش برای این کاربر مجاز نیست");
        }
        const result = await labCancelYaraneTransaction(Number(body.trId), {
          deleteHeader: body.deleteHeader !== false,
        });
        return NextResponse.json({
          ok: true,
          db: getDbTarget(),
          labWrites: labWritesEnabled(),
          by: user.username,
          result,
        });
      }
      default:
        return NextResponse.json(
          {
            ok: false,
            message:
              "action: create | calculate | review | person_list | thresholds | approve | cancel",
          },
          { status: 400 },
        );
    }
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message: err instanceof Error ? err.message : String(err),
        db: getDbTarget(),
      },
      { status: 500 },
    );
  }
}
