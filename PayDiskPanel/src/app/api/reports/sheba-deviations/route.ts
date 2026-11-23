import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/auth/http";
import { ensureActiveTarget, getActiveDbLabel, getDbTarget } from "@/lib/db/pool";
import {
  hasYaraneShebaReportTextFilter,
  labYaraneShebaDeviations,
  labYaraneShebaDeviationsCrossTxn,
  type YaraneShebaDeviationFilters,
} from "@/lib/sayah/yarane-deviations";

export const dynamic = "force-dynamic";

function pickFilter(sp: URLSearchParams, key: keyof YaraneShebaDeviationFilters) {
  const v = sp.get(key)?.trim();
  return v || undefined;
}

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  await ensureActiveTarget();

  const sp = new URL(req.url).searchParams;
  const trIdRaw = (sp.get("trId") || "").trim();
  const trId = trIdRaw ? Number(trIdRaw) : 0;
  const hasTrId = Number.isFinite(trId) && trId > 0;

  const page = Math.max(1, Number(sp.get("page") || 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(sp.get("pageSize") || 15) || 15));
  const refreshSayah =
    sp.get("refreshSayah") === "1" || sp.get("refreshSayah") === "true";
  const sayahLimit = sp.get("sayahLimit") ? Number(sp.get("sayahLimit")) : 40;

  const onlySayahMismatch =
    sp.get("onlySayahMismatch") === "1" ||
    sp.get("onlySayahMismatch") === "true" ||
    sp.get("sayahDeviation") === "1";

  const filters: YaraneShebaDeviationFilters = {
    FirstName: pickFilter(sp, "FirstName"),
    LastName: pickFilter(sp, "LastName"),
    NID: pickFilter(sp, "NID"),
    Center: pickFilter(sp, "Center"),
    Province: pickFilter(sp, "Province"),
    Account: pickFilter(sp, "Account"),
    NationalId: pickFilter(sp, "NationalId"),
    ibn: pickFilter(sp, "ibn"),
    sayahDeviation: onlySayahMismatch
      ? undefined
      : pickFilter(sp, "sayahDeviation"),
  };

  if (!hasTrId && !hasYaraneShebaReportTextFilter(filters)) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "شناسه تراکنش یا حداقل یک فیلتر (نام، کد ملی، مرکز، استان، …) لازم است",
      },
      { status: 400 },
    );
  }

  try {
    const result = hasTrId
      ? await labYaraneShebaDeviations(trId, {
          page,
          pageSize,
          sayahLimit,
          refreshSayah,
          filters,
          onlySayahMismatch,
        })
      : await labYaraneShebaDeviationsCrossTxn({
          page,
          pageSize,
          sayahLimit,
          filters,
          onlySayahMismatch,
        });

    return NextResponse.json({
      ok: true,
      db: getDbTarget(),
      dbLabel: getActiveDbLabel(),
      result,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "خطای گزارش مغایرت شبا";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
