import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/auth/http";
import { ensureActiveTarget, getReadPool, sql } from "@/lib/db/pool";

export const dynamic = "force-dynamic";

/**
 * Searchable centers list.
 * - No `q`: returns a small starter set (default 5) for dropdown startup.
 * - With `q`: returns matches (up to `limit`).
 * Optional trId scopes to that یارانه transaction.
 */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  await ensureActiveTarget();

  const sp = new URL(req.url).searchParams;
  const q = String(sp.get("q") || "")
    .trim()
    .replace(/[%_\[\]]/g, "");
  const trIdRaw = sp.get("trId");
  const trId = trIdRaw ? Number(trIdRaw) : 0;
  const hasTrId = Number.isFinite(trId) && trId > 0;
  const defaultLimit = q ? 20 : 5;
  const limit = Math.min(
    40,
    Math.max(1, Number(sp.get("limit") || defaultLimit) || defaultLimit),
  );

  try {
    const pool = await getReadPool();
    const reqDb = pool.request();
    reqDb.timeout = 30_000;
    reqDb.input("limit", sql.Int, limit);
    if (q) reqDb.input("q", sql.NVarChar, `%${q}%`);

    let rs;
    if (hasTrId) {
      reqDb.input("id", sql.Int, trId);
      rs = await reqDb.query(
        q
          ? `
            SELECT TOP (@limit)
              cntr.CenterId,
              LTRIM(RTRIM(cntr.CenterTitle)) AS CenterTitle,
              COUNT_BIG(*) AS payRows
            FROM dbo.PayedMakeOvers AS p WITH (NOLOCK)
            INNER JOIN dbo.Center AS cntr WITH (NOLOCK)
              ON cntr.CenterId = p.CenterId
            WHERE p.TransactionId = @id
              AND cntr.CenterTitle LIKE @q
            GROUP BY cntr.CenterId, cntr.CenterTitle
            ORDER BY COUNT_BIG(*) DESC, LTRIM(RTRIM(cntr.CenterTitle))
          `
          : `
            SELECT TOP (@limit)
              cntr.CenterId,
              LTRIM(RTRIM(cntr.CenterTitle)) AS CenterTitle,
              COUNT_BIG(*) AS payRows
            FROM dbo.PayedMakeOvers AS p WITH (NOLOCK)
            INNER JOIN dbo.Center AS cntr WITH (NOLOCK)
              ON cntr.CenterId = p.CenterId
            WHERE p.TransactionId = @id
            GROUP BY cntr.CenterId, cntr.CenterTitle
            ORDER BY COUNT_BIG(*) DESC, LTRIM(RTRIM(cntr.CenterTitle))
          `,
      );
    } else {
      rs = await reqDb.query(
        q
          ? `
            SELECT TOP (@limit)
              cntr.CenterId,
              LTRIM(RTRIM(cntr.CenterTitle)) AS CenterTitle,
              CAST(0 AS BIGINT) AS payRows
            FROM dbo.Center AS cntr WITH (NOLOCK)
            WHERE cntr.CenterTitle LIKE @q
              AND cntr.CenterTitle IS NOT NULL
              AND LTRIM(RTRIM(cntr.CenterTitle)) <> N''
            ORDER BY LTRIM(RTRIM(cntr.CenterTitle))
          `
          : `
            SELECT TOP (@limit)
              cntr.CenterId,
              LTRIM(RTRIM(cntr.CenterTitle)) AS CenterTitle,
              CAST(0 AS BIGINT) AS payRows
            FROM dbo.Center AS cntr WITH (NOLOCK)
            WHERE cntr.CenterTitle IS NOT NULL
              AND LTRIM(RTRIM(cntr.CenterTitle)) <> N''
            ORDER BY cntr.CenterId DESC
          `,
      );
    }

    const centers = (
      rs.recordset as Array<{
        CenterId: number;
        CenterTitle: string | null;
        payRows: number;
      }>
    ).map((r) => ({
      id: Number(r.CenterId),
      title: String(r.CenterTitle || "").trim() || `مرکز ${r.CenterId}`,
      payRows: Number(r.payRows || 0),
    }));

    return NextResponse.json({
      ok: true,
      trId: hasTrId ? trId : null,
      q,
      limit,
      centers,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "جستجوی مراکز ناموفق";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
