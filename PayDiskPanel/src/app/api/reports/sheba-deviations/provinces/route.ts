import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/auth/http";
import { ensureActiveTarget, getReadPool, sql } from "@/lib/db/pool";

export const dynamic = "force-dynamic";

/**
 * Searchable استان list for Sheba report filters.
 * Returns all provinces (Iran ~31) or matches when `q` is set.
 */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  await ensureActiveTarget();

  const sp = new URL(req.url).searchParams;
  const q = String(sp.get("q") || "")
    .trim()
    .replace(/[%_\[\]]/g, "");
  const limit = Math.min(40, Math.max(1, Number(sp.get("limit") || 40) || 40));

  try {
    const pool = await getReadPool();
    const reqDb = pool.request();
    reqDb.timeout = 30_000;
    reqDb.input("limit", sql.Int, limit);
    if (q) reqDb.input("q", sql.NVarChar, `%${q}%`);

    const rs = await reqDb.query(
      q
        ? `
          SELECT TOP (@limit)
            pr.ProvinceId,
            LTRIM(RTRIM(pr.ProvinceTitle)) AS ProvinceTitle
          FROM dbo.Province AS pr WITH (NOLOCK)
          WHERE pr.ProvinceTitle IS NOT NULL
            AND LTRIM(RTRIM(pr.ProvinceTitle)) <> N''
            AND pr.ProvinceTitle LIKE @q
          ORDER BY LTRIM(RTRIM(pr.ProvinceTitle))
        `
        : `
          SELECT TOP (@limit)
            pr.ProvinceId,
            LTRIM(RTRIM(pr.ProvinceTitle)) AS ProvinceTitle
          FROM dbo.Province AS pr WITH (NOLOCK)
          WHERE pr.ProvinceTitle IS NOT NULL
            AND LTRIM(RTRIM(pr.ProvinceTitle)) <> N''
          ORDER BY LTRIM(RTRIM(pr.ProvinceTitle))
        `,
    );

    const provinces = (
      rs.recordset as Array<{ ProvinceId: number; ProvinceTitle: string | null }>
    ).map((r) => ({
      id: Number(r.ProvinceId),
      title: String(r.ProvinceTitle || "").trim() || `استان ${r.ProvinceId}`,
    }));

    return NextResponse.json({
      ok: true,
      q,
      limit,
      provinces,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "جستجوی استان‌ها ناموفق";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
