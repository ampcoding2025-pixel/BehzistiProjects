import { getReadPool, getSqlTypes } from "@/lib/db/pool";
import type { ArmaghanTxnListItem, TriFilter } from "@/lib/armaghan/inspect";
import { inferStage, resolveRegistrarLabel } from "@/lib/armaghan/inspect";
import { MOSTAMARI_KY_BY_TYPE } from "@/lib/auth/disk-types";
import { formatTxnTitleFa } from "@/lib/format";

export type MostamariListFilters = {
  q?: string;
  page?: number;
  pageSize?: number;
  approvedOnly?: boolean;
  /** Not yet accepted (draft) */
  draftOnly?: boolean;
  /** mst-base, mst-hadafmandi, … */
  typeIds?: string[] | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  hasBank?: TriFilter;
  hasPeopleList?: TriFilter;
  registrar?: string | null;
};

/** Name join only when search needs it — avoids COUNT inflation on MappedPersonnel. */
const REG_JOINS = `
  LEFT JOIN dbo.[User] ru ON ru.ID = t.UserRegistrarId
  OUTER APPLY (
    SELECT TOP 1
      NULLIF(LTRIM(RTRIM(ISNULL(per.FirstName, N'') + N' ' + ISNULL(per.LastName, N''))), N'') AS RegistrarName
    FROM dbo.MappedPersonnel mp WITH (NOLOCK)
    INNER JOIN dbo.Personnel per WITH (NOLOCK) ON per.Id = mp.PersonnelId
    WHERE mp.UserId = ru.ID
  ) rnm
`;

const REG_NAME = `rnm.RegistrarName`;

function withQueryTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new Error(
            `${label} timed out after ${Math.round(ms / 1000)}s — try fewer filters or lab/replica`,
          ),
        ),
      ms,
    );
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export async function listMostamariTransactions(opts: MostamariListFilters) {
  const pageSize = Math.min(50, Math.max(1, opts.pageSize || 15));
  const page = Math.max(1, opts.page || 1);
  const q = (opts.q || "").trim();
  const dateFrom = (opts.dateFrom || "").trim() || null;
  const dateTo = (opts.dateTo || "").trim() || null;
  const registrar = (opts.registrar || "").trim() || null;
  const typeIds = [
    ...new Set((opts.typeIds || []).map((s) => String(s).trim()).filter(Boolean)),
  ];
  const kys = typeIds
    .map((id) => MOSTAMARI_KY_BY_TYPE[id])
    .filter(Boolean) as string[];

  const needsRegJoin = !!(q || registrar);

  const clauses: string[] = ["(1=1)"];
  if (q) {
    clauses.push(
      needsRegJoin
        ? `(
      t.Title LIKE @q OR CAST(t.Id AS nvarchar(30)) LIKE @q
      OR ISNULL(t.Ky, N'') LIKE @q
      OR ISNULL(ru.UserID, N'') LIKE @q
      OR (${REG_NAME}) LIKE @q
    )`
        : `(
      t.Title LIKE @q OR CAST(t.Id AS nvarchar(30)) LIKE @q
      OR ISNULL(t.Ky, N'') LIKE @q
    )`,
    );
  }
  if (dateFrom) clauses.push(`t.RegistrationDate >= @dateFrom`);
  if (dateTo) clauses.push(`t.RegistrationDate < DATEADD(day, 1, @dateTo)`);
  if (opts.draftOnly) {
    clauses.push(`(t.AcceptorUserId IS NULL AND t.AcceptanceDateTime IS NULL)`);
  } else if (opts.approvedOnly) {
    clauses.push(`(t.AcceptorUserId IS NOT NULL OR t.AcceptanceDateTime IS NOT NULL)`);
  }
  if (opts.hasBank === "yes") {
    clauses.push(`(
      (t.ExportToken IS NOT NULL AND t.ExportToken <> N'')
      OR (t.FileName IS NOT NULL AND t.FileName <> N'')
    )`);
  } else if (opts.hasBank === "no") {
    clauses.push(`(
      (t.ExportToken IS NULL OR t.ExportToken = N'')
      AND (t.FileName IS NULL OR t.FileName = N'')
    )`);
  }
  if (opts.hasPeopleList === "yes") {
    clauses.push(`(t.ListToken IS NOT NULL AND t.ListToken <> N'')`);
  } else if (opts.hasPeopleList === "no") {
    clauses.push(`(t.ListToken IS NULL OR t.ListToken = N'')`);
  }
  if (registrar) {
    clauses.push(`(
      ISNULL(ru.UserID, N'') LIKE @registrar
      OR (${REG_NAME}) LIKE @registrar
    )`);
  }
  if (kys.length) {
    const inList = kys.map((_, i) => `@ky${i}`).join(", ");
    clauses.push(`t.Ky IN (${inList})`);
  }

  const whereSql = clauses.join("\n      AND ");
  const joinSql = needsRegJoin ? REG_JOINS : "";

  const pool = await getReadPool();
  const types = await getSqlTypes();

  function bind(
    req: { input: (n: string, t: unknown, v: unknown) => unknown },
    extra?: { offset?: number; pageSize?: number },
  ) {
    if (q) req.input("q", types.NVarChar, `%${q}%`);
    if (dateFrom) req.input("dateFrom", types.Date, dateFrom);
    if (dateTo) req.input("dateTo", types.Date, dateTo);
    if (registrar) req.input("registrar", types.NVarChar, `%${registrar}%`);
    kys.forEach((ky, i) => req.input(`ky${i}`, types.NVarChar, ky));
    if (extra?.offset != null) req.input("offset", types.Int, extra.offset);
    if (extra?.pageSize != null) req.input("pageSize", types.Int, extra.pageSize);
  }

  // Fast count: no PayedContinusPayment, registrar joins only if filtering by name
  const countReq = pool.request();
  bind(countReq);
  const countRs = await withQueryTimeout(
    countReq.query(`
      SELECT COUNT_BIG(*) AS total
      FROM dbo.PayedTransaction t WITH (NOLOCK)
      ${joinSql}
      WHERE ${whereSql}
    `),
    25000,
    "Mostamari count",
  );
  const total = Number(countRs.recordset[0]?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(page, totalPages);

  // List must stay header-only. Counting/EXISTS against PayedContinusPayment
  // hangs on prod 155 (huge table). Full counts belong on the detail page.
  const listReq = pool.request();
  bind(listReq, {
    offset: (safePage - 1) * pageSize,
    pageSize,
  });
  const listRs = await withQueryTimeout(
    listReq.query(`
      ;WITH page_ids AS (
        SELECT t.Id
        FROM dbo.PayedTransaction t WITH (NOLOCK)
        ${joinSql}
        WHERE ${whereSql}
        ORDER BY t.Id DESC
        OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
      )
      SELECT
        t.Id,
        t.Title,
        t.RegistrationDate AS [Date],
        ru.UserID AS Registrar,
        rnm.RegistrarName,
        t.RegistrationDate AS RegistrationDateTime,
        t.Ky AS Key1,
        t.ListToken AS Key2,
        ISNULL(t.FileName, t.ExportToken) AS Key3
      FROM page_ids pid
      INNER JOIN dbo.PayedTransaction t WITH (NOLOCK) ON t.Id = pid.Id
      LEFT JOIN dbo.[User] ru WITH (NOLOCK) ON ru.ID = t.UserRegistrarId
      OUTER APPLY (
        SELECT TOP 1
          NULLIF(LTRIM(RTRIM(ISNULL(per.FirstName, N'') + N' ' + ISNULL(per.LastName, N''))), N'') AS RegistrarName
        FROM dbo.MappedPersonnel mp WITH (NOLOCK)
        INNER JOIN dbo.Personnel per WITH (NOLOCK) ON per.Id = mp.PersonnelId
        WHERE mp.UserId = ru.ID
      ) rnm
      ORDER BY t.Id DESC
    `),
    25000,
    "Mostamari list",
  );

  const items: ArmaghanTxnListItem[] = (listRs.recordset || []).map((r) => {
    const row = r as Record<string, unknown>;
    // Placeholder — detail endpoint loads real PayedContinusPayment counts.
    const payedRows = 0;
    const key2 = row.Key2 != null ? String(row.Key2) : null;
    const key3 = row.Key3 != null ? String(row.Key3) : null;
    const inferred = inferStage({
      payedRows,
      Key2: key2,
      Key3: key3,
    });
    const reg = row.Registrar != null ? String(row.Registrar) : null;
    const registrarName = row.RegistrarName
      ? String(row.RegistrarName).trim() || null
      : null;
    const titleFa = formatTxnTitleFa(row.Title);
    return {
      Id: Number(row.Id),
      Title: titleFa === "—" ? (row.Title as string | null) : titleFa,
      Date: (row.Date as string | null) || null,
      Registrar: reg,
      RegistrarName: registrarName,
      RegistrarLabel: resolveRegistrarLabel(reg, registrarName),
      RegistrationDateTime: (row.RegistrationDateTime as string | null) || null,
      Key1: row.Key1 != null ? String(row.Key1) : null,
      Key2: key2,
      Key3: key3,
      payedRows,
      payedRowsExact: false,
      supplyCount: 0,
      ...inferred,
    };
  });

  return { items, total, page: safePage, pageSize, totalPages };
}
