import { NextResponse } from "next/server";
import { getEffectiveAccess } from "@/lib/auth/access";
import { getSessionUser, unauthorized } from "@/lib/auth/http";
import { listArmaghanTransactions } from "@/lib/armaghan/inspect";
import { listMostamariTransactions } from "@/lib/armaghan/mostamari-list";
import {
  ensureActiveTarget,
  getActiveDbLabel,
  getDbMode,
  getDbTarget,
} from "@/lib/db/pool";
import { labWritesEnabled } from "@/lib/lab/writes";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const url = new URL(req.url);
  try {
    const statusRaw = (url.searchParams.get("status") || "").toLowerCase();
    const status =
      statusRaw === "draft" || statusRaw === "approved" ? statusRaw : "";
    const approvedFlag =
      url.searchParams.get("approved") === "1" ||
      url.searchParams.get("approvedOnly") === "1";
    const draftOnly = status === "draft";
    const approvedOnly =
      !draftOnly && (status === "approved" || approvedFlag);
    const tri = (key: string) => {
      const v = (url.searchParams.get(key) || "").toLowerCase();
      return v === "yes" || v === "no" ? v : "";
    };
    await ensureActiveTarget();
    const access = await getEffectiveAccess(user.username, user.role);
    const familyRaw = (url.searchParams.get("family") || "yarane").toLowerCase();
    const family = familyRaw === "mostamari" ? "mostamari" : "yarane";

    // status owns Key2/acceptance; ignore overlapping hasPeopleList
    const hasPeopleList =
      draftOnly || approvedOnly ? ("" as const) : tri("hasPeopleList");

    const common = {
      q: url.searchParams.get("q") || "",
      page: Number(url.searchParams.get("page") || 1),
      pageSize: Number(url.searchParams.get("pageSize") || 15),
      approvedOnly,
      draftOnly,
      dateFrom: url.searchParams.get("dateFrom") || null,
      dateTo: url.searchParams.get("dateTo") || null,
      hasBank: tri("hasBank") as "" | "yes" | "no",
      hasPeopleList: hasPeopleList as "" | "yes" | "no",
      registrar: url.searchParams.get("registrar") || null,
    };

    const result =
      family === "mostamari"
        ? await (() => {
            const requested = (url.searchParams.get("mostamariTypeIds") || "")
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
            const allowed = access.allowedMostamariIds;
            const typeIds =
              allowed == null
                ? requested
                : requested.length
                  ? requested.filter((id) => allowed.includes(id))
                  : allowed;
            if (Array.isArray(allowed) && allowed.length === 0) {
              return Promise.resolve({
                items: [],
                total: 0,
                page: common.page,
                pageSize: common.pageSize,
                totalPages: 1,
              });
            }
            if (Array.isArray(allowed) && requested.length && typeIds.length === 0) {
              return Promise.resolve({
                items: [],
                total: 0,
                page: common.page,
                pageSize: common.pageSize,
                totalPages: 1,
              });
            }
            return listMostamariTransactions({
              ...common,
              typeIds,
            });
          })()
        : await (() => {
            const supplyLocationIds = [
              ...new Set(
                (
                  url.searchParams.get("supplyLocationIds") ||
                  url.searchParams.get("supplyLocationId") ||
                  ""
                )
                  .split(",")
                  .map((s) => Number(s.trim()))
                  .filter((n) => Number.isFinite(n) && n > 0)
                  .map((n) => Math.trunc(n)),
              ),
            ];
            return listArmaghanTransactions({
              ...common,
              allowedSupplyIds: access.allowedSupplyIds,
              supplyLocationIds: supplyLocationIds.length
                ? supplyLocationIds
                : null,
            });
          })();

    return NextResponse.json({
      ok: true,
      family,
      db: getDbTarget(),
      dbLabel: getActiveDbLabel(),
      mode: getDbMode(),
      readonly: !labWritesEnabled(),
      labWrites: labWritesEnabled(),
      ...result,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
