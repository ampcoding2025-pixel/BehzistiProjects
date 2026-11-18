import {
  getReadPool,
  getSchemaCaps,
  getSqlTypes,
  isLabDb,
  sql,
} from "@/lib/db/pool";
import type { DbSchemaCaps } from "@/lib/db/schema";
import { loadUsers } from "@/lib/auth/users";
import { formatFaDate, formatTxnTitleFa } from "@/lib/format";

export type ArmaghanTxnListItem = {
  Id: number;
  Title: string | null;
  Date: string | null;
  /** UserID stored on the transaction */
  Registrar: string | null;
  /** First+Last from Personnel when mapped */
  RegistrarName: string | null;
  /** Display: «نام (UserID)» when name exists */
  RegistrarLabel: string | null;
  RegistrationDateTime: string | null;
  Key1: string | null;
  Key2: string | null;
  Key3: string | null;
  /** Exact count when loaded; list queries leave this 0 and set payedRowsExact=false. */
  payedRows: number;
  /** false = list skipped heavy COUNT (show dash + load). */
  payedRowsExact?: boolean;
  supplyCount: number;
  stage: ArmaghanStageId;
  stageLabel: string;
  deviations: string[];
};

function allowlistDisplayName(username: string | null | undefined) {
  const uid = (username || "").trim();
  if (!uid) return null;
  const hit = loadUsers().find(
    (u) => u.username.toLowerCase() === uid.toLowerCase(),
  );
  return hit?.displayName?.trim() || null;
}

/** Prefer personnel name, then panel allowlist displayName. */
export function resolveRegistrarLabel(
  userId: string | null | undefined,
  personName?: string | null,
) {
  const id = (userId || "").trim() || null;
  const name =
    (personName || "").trim() || allowlistDisplayName(id) || null;
  if (name && id && name.toLowerCase() !== id.toLowerCase()) {
    return `${name} (${id})`;
  }
  return name || id;
}

/** JOIN path: Registrar UserID → User → MappedPersonnel → Personnel */
const REGISTRAR_JOINS = `
  LEFT JOIN dbo.[User] ru
    ON ru.UserID COLLATE DATABASE_DEFAULT = t.Registrar COLLATE DATABASE_DEFAULT
  LEFT JOIN dbo.MappedPersonnel rmp ON rmp.UserId = ru.ID
  LEFT JOIN dbo.Personnel rper ON rper.Id = rmp.PersonnelId
`;

const REGISTRAR_NAME_EXPR = `
  NULLIF(LTRIM(RTRIM(ISNULL(rper.FirstName, N'') + N' ' + ISNULL(rper.LastName, N''))), N'')
`;

export type ArmaghanStageId =
  | "txn"
  | "type"
  | "calc"
  | "list"
  | "manager";

export const ARMAGHAN_STAGES: {
  id: ArmaghanStageId;
  label: string;
  armaghan: string;
}[] = [
  { id: "txn", label: "تراکنش", armaghan: "دکمه جدید / ثبت" },
  { id: "type", label: "نوع محاسبه", armaghan: "مودال نوع + محل تأمین" },
  { id: "calc", label: "محاسبه", armaghan: "کلید محاسبه / PayedMakeOvers" },
  { id: "list", label: "لیست افراد", armaghan: "تهیه لیست افراد" },
  { id: "manager", label: "گزارش و اقدام", armaghan: "بازرسی مدیر" },
];

function filled(v: unknown) {
  return v != null && String(v).trim() !== "" && String(v).trim() !== "0";
}

export function inferStage(row: {
  payedRows: number;
  Key2: string | null;
  Key3: string | null;
}): { stage: ArmaghanStageId; stageLabel: string; deviations: string[] } {
  const hasCalc = Number(row.payedRows) > 0;
  const hasList = filled(row.Key2);
  const hasBank = filled(row.Key3);
  const deviations: string[] = [];

  if (hasCalc && !hasList) {
    deviations.push("محاسبه شده ولی لیست افراد خالی است — انحراف بحرانی قبل از مالی");
  }
  if (hasList && !hasCalc) {
    deviations.push("لیست افراد پر است ولی ردیف محاسبه صفر است — ناسازگاری");
  }
  if (!hasCalc && !hasList) {
    deviations.push("فقط ثبت شده؛ محاسبه و لیست انجام نشده");
  }
  if (hasList && !hasBank) {
    deviations.push("لیست آماده است؛ دیسکت بانک معمولاً با مالی است — اختیاری");
  }

  let stage: ArmaghanStageId = "txn";
  if (hasBank) stage = "manager";
  else if (hasList) stage = "manager";
  else if (hasCalc) stage = "list";
  else stage = "type";

  const label =
    ARMAGHAN_STAGES.find((s) => s.id === stage)?.label || stage;
  return { stage, stageLabel: label, deviations };
}

export type TriFilter = "" | "yes" | "no";

export type TxnListFilters = {
  q?: string;
  page?: number;
  pageSize?: number;
  /** After wizard approve: Key2 filled (list-ready) */
  approvedOnly?: boolean;
  /** Draft / not yet approved: Key2 empty */
  draftOnly?: boolean;
  /**
   * Restrict by MakeOverSupplyLocationId.
   * Matches Key1 (wizard) or any PayedMakeOvers supply on the txn.
   * null/undefined = no restriction; [] = empty result.
   */
  allowedSupplyIds?: number[] | null;
  /** Filter to one supply / type (legacy single) */
  supplyLocationId?: number | null;
  /** Filter to one or more supply / types (preferred) */
  supplyLocationIds?: number[] | null;
  /** Inclusive ISO date YYYY-MM-DD */
  dateFrom?: string | null;
  dateTo?: string | null;
  /** دیسکت بانک (Key3) */
  hasBank?: TriFilter;
  /** لیست افراد (Key2) */
  hasPeopleList?: TriFilter;
  /** ثبت‌کننده — UserID or name fragment */
  registrar?: string | null;
};

function bindListParams(
  req: {
    input: (name: string, type: unknown, value: unknown) => unknown;
  },
  types: { NVarChar: unknown; Int: unknown; Date: unknown },
  opts: {
    q: string;
    dateFrom: string | null;
    dateTo: string | null;
    typeId: number | null;
    typeIdText: string | null;
    registrar: string | null;
    offset?: number;
    pageSize?: number;
  },
) {
  if (opts.q) req.input("q", types.NVarChar, `%${opts.q}%`);
  if (opts.dateFrom) req.input("dateFrom", types.Date, opts.dateFrom);
  if (opts.dateTo) req.input("dateTo", types.Date, opts.dateTo);
  if (opts.typeId != null) req.input("typeId", types.Int, opts.typeId);
  if (opts.typeIdText) req.input("typeIdText", types.NVarChar, opts.typeIdText);
  if (opts.registrar) {
    req.input("registrar", types.NVarChar, `%${opts.registrar}%`);
  }
  if (opts.offset != null) req.input("offset", types.Int, opts.offset);
  if (opts.pageSize != null) req.input("pageSize", types.Int, opts.pageSize);
}

export async function listArmaghanTransactions(opts: TxnListFilters) {
  const pageSize = Math.min(50, Math.max(1, opts.pageSize || 15));
  const page = Math.max(1, opts.page || 1);
  const q = (opts.q || "").trim();
  const approvedOnly = !!opts.approvedOnly && !opts.draftOnly;
  const draftOnly = !!opts.draftOnly;
  const allowed = opts.allowedSupplyIds;
  const dateFrom = (opts.dateFrom || "").trim() || null;
  const dateTo = (opts.dateTo || "").trim() || null;
  const registrar = (opts.registrar || "").trim() || null;

  const rawFilterIds = [
    ...(Array.isArray(opts.supplyLocationIds) ? opts.supplyLocationIds : []),
    ...(opts.supplyLocationId != null ? [opts.supplyLocationId] : []),
  ]
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0)
    .map((n) => Math.trunc(n));
  const filterTypeIds = [...new Set(rawFilterIds)];

  if (Array.isArray(allowed) && allowed.length === 0) {
    return { items: [] as ArmaghanTxnListItem[], total: 0, page, pageSize, totalPages: 1 };
  }

  const caps = await getSchemaCaps();
  const useDefs = definitionTypeMatchSql(caps);

  const approvedClause = approvedOnly
    ? ` AND t.Key2 IS NOT NULL AND t.Key2 <> N''`
    : draftOnly
      ? ` AND (t.Key2 IS NULL OR t.Key2 = N'')`
      : "";

  const allowedIds = Array.isArray(allowed)
    ? [...new Set(allowed.map(Number).filter((n) => Number.isFinite(n) && n > 0))]
    : null;

  // User type filter ∩ ACL (when both present)
  let effectiveTypeIds: number[] | null = null;
  if (filterTypeIds.length && allowedIds) {
    const allow = new Set(allowedIds);
    effectiveTypeIds = filterTypeIds.filter((id) => allow.has(id));
    if (!effectiveTypeIds.length) {
      return { items: [] as ArmaghanTxnListItem[], total: 0, page, pageSize, totalPages: 1 };
    }
  } else if (filterTypeIds.length) {
    effectiveTypeIds = filterTypeIds;
  } else if (allowedIds && allowedIds.length) {
    effectiveTypeIds = allowedIds;
  }

  const typeListSql =
    effectiveTypeIds && effectiveTypeIds.length
      ? effectiveTypeIds.map((n) => String(n)).join(",")
      : null;

  // Type/ACL:
  // - Lab (defs): Key1 numeric or MakeOverDefinitions.SupplyLocationId
  // - 155/157: after calculate → PayedMakeOvers; before calculate → Description
  //   matches MakeOverSupplyLocationTitle (wizard stores titleFa there; Key1 is
  //   NULL/GUID like Armaghan — never the supply id).
  const typeClause = typeListSql
    ? useDefs
      ? ` AND (
      TRY_CONVERT(int, NULLIF(LTRIM(RTRIM(t.Key1)), N'')) IN (${typeListSql})
      OR EXISTS (
        SELECT 1 FROM dbo.MakeOverDefinitions d1 WITH (NOLOCK)
        WHERE d1.Id = t.DefinitionId
          AND d1.SupplyLocationId IN (${typeListSql})
      )
    )`
      : ` AND (
      EXISTS (
        SELECT 1
        FROM dbo.PayedMakeOvers px WITH (NOLOCK)
        WHERE px.TransactionId = t.Id
          AND px.MakeOverSupplyLocationId IN (${typeListSql})
      )
      OR EXISTS (
        SELECT 1
        FROM dbo.MakeOverSupplyLocation s WITH (NOLOCK)
        WHERE s.MakeOverSupplyLocationId IN (${typeListSql})
          AND t.Description IS NOT NULL
          AND LTRIM(RTRIM(t.Description)) = LTRIM(RTRIM(s.MakeOverSupplyLocationTitle))
      )
      OR TRY_CONVERT(int, NULLIF(LTRIM(RTRIM(t.Key1)), N'')) IN (${typeListSql})
    )`
    : "";

  const dateClause = [
    dateFrom ? ` AND t.Date >= @dateFrom` : "",
    dateTo ? ` AND t.Date <= @dateTo` : "",
  ].join("");

  const keyFilled = (col: string) =>
    `(${col} IS NOT NULL AND ${col} <> N'' AND ${col} <> N'0')`;
  const keyEmpty = (col: string) =>
    `(${col} IS NULL OR ${col} = N'' OR ${col} = N'0')`;

  const bankClause =
    opts.hasBank === "yes"
      ? ` AND ${keyFilled("t.Key3")}`
      : opts.hasBank === "no"
        ? ` AND ${keyEmpty("t.Key3")}`
        : "";

  const peopleClause =
    opts.hasPeopleList === "yes"
      ? ` AND ${keyFilled("t.Key2")}`
      : opts.hasPeopleList === "no"
        ? ` AND ${keyEmpty("t.Key2")}`
        : "";

  const needsRegistrarJoin = !!(q || registrar);

  const registrarClause = registrar
    ? `
    AND (
      t.Registrar LIKE @registrar OR
      rper.FirstName LIKE @registrar OR
      rper.LastName LIKE @registrar OR
      (${REGISTRAR_NAME_EXPR}) LIKE @registrar
    )`
    : "";

  const searchClause = q
    ? needsRegistrarJoin
      ? `(t.Title LIKE @q OR CAST(t.Id AS nvarchar(30)) LIKE @q
         OR t.Registrar LIKE @q OR t.Key2 LIKE @q
         OR rper.FirstName LIKE @q OR rper.LastName LIKE @q
         OR (${REGISTRAR_NAME_EXPR}) LIKE @q)`
      : `(t.Title LIKE @q OR CAST(t.Id AS nvarchar(30)) LIKE @q
         OR t.Registrar LIKE @q OR t.Key2 LIKE @q)`
    : `(1=1)`;

  const joinSql = needsRegistrarJoin ? REGISTRAR_JOINS : "";

  const whereTail = `
    AND ${searchClause}
    ${approvedClause}
    ${dateClause}
    ${bankClause}
    ${peopleClause}
    ${registrarClause}
    ${typeClause}
  `;

  const hasFilters = !!(
    q ||
    registrar ||
    (effectiveTypeIds && effectiveTypeIds.length) ||
    dateFrom ||
    dateTo ||
    opts.hasBank ||
    opts.hasPeopleList ||
    approvedOnly ||
    draftOnly
  );

  const pool = await getReadPool();
  const types = await getSqlTypes();
  const baseBind = {
    q,
    dateFrom,
    dateTo,
    typeId: null as number | null,
    typeIdText: null as string | null,
    registrar,
  };

  type ListRow = {
    Id: number;
    Title: string | null;
    Date: string | null;
    Registrar: string | null;
    RegistrarName: string | null;
    RegistrationDateTime: string | null;
    Key1: string | null;
    Key2: string | null;
    Key3: string | null;
    payedRows: number;
    supplyCount: number;
  };

  const fromTxn = `
      FROM dbo.MakeOverTransactions t WITH (NOLOCK)
      ${joinSql}
      WHERE (1=1)
      ${whereTail}
    `;

  // Header-only page (like mostamari). Exact PayedMakeOvers COUNT is on-demand via /stats.
  const listSql = `
    ;WITH page_ids AS (
      SELECT t.Id
      ${fromTxn}
      ORDER BY t.Id DESC
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    )
    SELECT
      t.Id, t.Title, t.Date, t.Registrar, t.RegistrationDateTime,
      t.Key1, t.Key2, t.Key3,
      (${REGISTRAR_NAME_EXPR}) AS RegistrarName,
      0 AS payedRows,
      0 AS supplyCount
    FROM page_ids pid
    INNER JOIN dbo.MakeOverTransactions t WITH (NOLOCK) ON t.Id = pid.Id
    ${REGISTRAR_JOINS}
    ORDER BY t.Id DESC
  `;

  const countSql = `
      SELECT COUNT_BIG(*) AS total
      FROM dbo.MakeOverTransactions t WITH (NOLOCK)
      ${joinSql}
      WHERE (1=1)
      ${whereTail}
    `;

  const runList = async (p: number) => {
    const listReq = pool.request();
    bindListParams(listReq, types, {
      ...baseBind,
      offset: (p - 1) * pageSize,
      pageSize,
    });
    return (await listReq.query(listSql)).recordset as ListRow[];
  };

  let rows = await runList(page);

  let total = 0;
  if (!hasFilters) {
    try {
      const approx = await pool.request().query(`
        SELECT CAST(SUM(rows) AS bigint) AS total
        FROM sys.partitions WITH (NOLOCK)
        WHERE object_id = OBJECT_ID(N'dbo.MakeOverTransactions')
          AND index_id IN (0, 1)
      `);
      total = Number(approx.recordset[0]?.total || 0);
    } catch {
      total = 0;
    }
    if (!total) {
      total =
        rows.length < pageSize
          ? (page - 1) * pageSize + rows.length
          : page * pageSize + 1;
    }
  } else {
    const countReq = pool.request();
    bindListParams(countReq, types, baseBind);
    total = Number((await countReq.query(countSql)).recordset[0]?.total || 0);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(page, totalPages);

  if (total > 0 && page > totalPages) {
    rows = await runList(safePage);
  }

  const items: ArmaghanTxnListItem[] = rows.map((r) => {
    // Stage from keys only — payedRows COUNT is lazy (/stats) so list stays fast.
    const key2 = r.Key2;
    const key3 = r.Key3;
    const hasList = !!(key2 && String(key2).trim() && String(key2).trim() !== "0");
    const inferred = inferStage({
      payedRows: hasList ? 1 : 0,
      Key2: key2,
      Key3: key3,
    });
    const reg = (r.Registrar as string | null) || null;
    const registrarName = r.RegistrarName
      ? String(r.RegistrarName).trim() || null
      : null;
    const titleFa = formatTxnTitleFa(r.Title);
    return {
      Id: Number(r.Id),
      Title: titleFa === "—" ? r.Title : titleFa,
      Date: r.Date,
      Registrar: reg,
      RegistrarName: registrarName,
      RegistrarLabel: resolveRegistrarLabel(reg, registrarName),
      RegistrationDateTime: r.RegistrationDateTime,
      Key1: r.Key1,
      Key2: r.Key2,
      Key3: r.Key3,
      payedRows: 0,
      payedRowsExact: false,
      supplyCount: 0,
      ...inferred,
    };
  });

  return {
    items,
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

/** Lab-only: Definitions table + DefinitionId column both present. */
function definitionTypeMatchSql(caps: DbSchemaCaps) {
  return caps.hasMakeOverDefinitions && caps.hasTxnDefinitionId;
}

/**
 * Fast wizard open: header + cheap EXISTS (no write pool, no sample joins).
 * Exact PayedMakeOvers COUNT / sample stay on the «بررسی» step.
 */
export async function loadYaraneWizardTxn(id: number) {
  const pool = await getReadPool();
  const caps = await getSchemaCaps();
  const req = pool.request();
  req.input("id", sql.BigInt, id);

  const defSelect = definitionTypeMatchSql(caps)
    ? `
      t.DefinitionId,
      d.SupplyLocationId AS DefinitionSupplyLocationId`
    : `
      CAST(NULL AS int) AS DefinitionId,
      CAST(NULL AS int) AS DefinitionSupplyLocationId`;
  const defJoin = definitionTypeMatchSql(caps)
    ? `LEFT JOIN dbo.MakeOverDefinitions d WITH (NOLOCK) ON d.Id = t.DefinitionId`
    : "";

  const hdr = await req.query(`
    SELECT
      t.Id, t.Title, t.Date, t.Description, t.Registrar,
      t.Key1, t.Key2, t.Key3,
      ${defSelect},
      CASE WHEN EXISTS (
        SELECT 1 FROM dbo.PayedMakeOvers p WITH (NOLOCK)
        WHERE p.TransactionId = t.Id
      ) THEN 1 ELSE 0 END AS hasPayed
    FROM dbo.MakeOverTransactions t WITH (NOLOCK)
    ${defJoin}
    WHERE t.Id = @id
  `);
  const h = hdr.recordset[0];
  if (!h) return null;

  const hasPayed = Number(h.hasPayed || 0) === 1;
  let payedRows = 0;
  let supplyCount = 0;
  let subsidySum = 0;
  let supplyFromCalc: number | null = null;

  if (hasPayed) {
    const aggReq = pool.request();
    aggReq.input("id", sql.Int, id);
    const agg = await aggReq.query(`
      SELECT
        COUNT_BIG(*) AS payedRows,
        COUNT(DISTINCT MakeOverSupplyLocationId) AS supplyCount,
        SUM(ISNULL(LocalSubsidy,0) + ISNULL(UniverseSubsidy,0)) AS subsidySum,
        MIN(MakeOverSupplyLocationId) AS anySupply
      FROM dbo.PayedMakeOvers WITH (NOLOCK)
      WHERE TransactionId = @id
    `);
    const a = agg.recordset[0] || {};
    payedRows = Number(a.payedRows || 0);
    supplyCount = Number(a.supplyCount || 0);
    subsidySum = Number(a.subsidySum || 0);
    if (a.anySupply != null) supplyFromCalc = Number(a.anySupply);
  }

  const key1Num = Number(String(h.Key1 || "").trim());
  const supplyFromKey1 =
    Number.isFinite(key1Num) && key1Num > 0 ? key1Num : null;
  const supplyFromDef =
    h.DefinitionSupplyLocationId != null
      ? Number(h.DefinitionSupplyLocationId)
      : null;

  let supplyFromDesc: number | null = null;
  const desc = h.Description != null ? String(h.Description).trim() : "";
  if (!supplyFromCalc && !supplyFromKey1 && !supplyFromDef && desc) {
    const dReq = pool.request();
    dReq.input("desc", sql.NVarChar, desc);
    const dHit = await dReq.query(`
      SELECT TOP 1 MakeOverSupplyLocationId AS Id
      FROM dbo.MakeOverSupplyLocation WITH (NOLOCK)
      WHERE LTRIM(RTRIM(MakeOverSupplyLocationTitle)) = @desc
    `);
    if (dHit.recordset[0]?.Id != null) {
      supplyFromDesc = Number(dHit.recordset[0].Id);
    }
  }

  const dateRaw = h.Date;
  let date = "";
  if (dateRaw) {
    const d = new Date(String(dateRaw));
    date = !Number.isNaN(d.getTime())
      ? d.toISOString().slice(0, 10)
      : String(dateRaw).slice(0, 10);
  }

  return {
    trId: Number(h.Id),
    title: (h.Title as string | null) || null,
    date,
    description: desc || null,
    key1: (h.Key1 as string | null) || null,
    key2: (h.Key2 as string | null) || null,
    key3: (h.Key3 as string | null) || null,
    supplyLocationId:
      supplyFromCalc || supplyFromDef || supplyFromKey1 || supplyFromDesc,
    payedRows,
    supplyCount,
    subsidySum,
    approved: !!(h.Key2 && String(h.Key2).trim()),
  };
}

export async function getArmaghanTransactionDetail(
  id: number,
  opts?: { samplePage?: number; samplePageSize?: number },
) {
  const pool = await getReadPool();
  const caps = await getSchemaCaps();
  const samplePage = Math.max(1, Number(opts?.samplePage) || 1);
  const samplePageSize = Math.min(50, Math.max(5, Number(opts?.samplePageSize) || 15));
  const sampleOffset = (samplePage - 1) * samplePageSize;
  const txnReq = pool.request();
  txnReq.input("id", sql.BigInt, id);

  const defSelect = definitionTypeMatchSql(caps)
    ? `
      t.DefinitionId,
      d.Code AS DefinitionCode,
      d.Title AS DefinitionTitle,
      d.SupplyLocationId AS DefinitionSupplyLocationId,
      d.CreatedDateTime AS DefinitionCreatedDateTime`
    : `
      CAST(NULL AS int) AS DefinitionId,
      CAST(NULL AS nvarchar(50)) AS DefinitionCode,
      CAST(NULL AS nvarchar(200)) AS DefinitionTitle,
      CAST(NULL AS int) AS DefinitionSupplyLocationId,
      CAST(NULL AS datetime2) AS DefinitionCreatedDateTime`;

  const defJoin = definitionTypeMatchSql(caps)
    ? `LEFT JOIN dbo.MakeOverDefinitions d ON d.Id = t.DefinitionId`
    : "";

  const txn = await txnReq.query(`
    SELECT
      t.Id, t.Title, t.Date, t.Acceptor, t.Description, t.Registrar, t.RegistrationDateTime,
      t.Key1, t.Key2, t.Key3,
      ${defSelect},
      (${REGISTRAR_NAME_EXPR}) AS RegistrarName
    FROM dbo.MakeOverTransactions t
    ${REGISTRAR_JOINS}
    ${defJoin}
    WHERE t.Id = @id
  `);
  const header = txn.recordset[0];
  if (!header) return null;

  const payedReq = pool.request();
  payedReq.input("id", sql.Int, id);
  const payedAgg = await payedReq.query(`
    SELECT
      COUNT(*) AS payedRows,
      COUNT(DISTINCT MakeOverSupplyLocationId) AS supplyCount,
      SUM(ISNULL(LocalSubsidy,0) + ISNULL(UniverseSubsidy,0)) AS subsidySum,
      MIN(FromDate) AS minFromDate,
      MAX(FromDate) AS maxFromDate
    FROM dbo.PayedMakeOvers
    WHERE TransactionId = @id
  `);

  const suppliesReq = pool.request();
  suppliesReq.input("id", sql.Int, id);
  const supplies = await suppliesReq.query(`
    SELECT TOP 40
      p.MakeOverSupplyLocationId AS Id,
      ISNULL(s.MakeOverSupplyLocationTitle, N'(نامشخص)') AS Title,
      ISNULL(s.MakeOverSuplyLocationKeyword, N'') AS Keyword,
      COUNT(*) AS cnt
    FROM dbo.PayedMakeOvers p
    LEFT JOIN dbo.MakeOverSupplyLocation s
      ON s.MakeOverSupplyLocationId = p.MakeOverSupplyLocationId
    WHERE p.TransactionId = @id
    GROUP BY p.MakeOverSupplyLocationId, s.MakeOverSupplyLocationTitle, s.MakeOverSuplyLocationKeyword
    ORDER BY COUNT(*) DESC
  `);

  const sampleReq = pool.request();
  sampleReq.input("id", sql.Int, id);
  sampleReq.input("offset", sql.Int, sampleOffset);
  sampleReq.input("pageSize", sql.Int, samplePageSize);
  const sample = await sampleReq.query(`
    SELECT
      p.Id, p.PersonId, p.CenterId, p.MakeOverSupplyLocationId,
      p.LocalSubsidy, p.UniverseSubsidy, p.NewUniversalSubsidy,
      p.FromDate, p.CenterAccount, p.IsNoName, p.IsSpecial
    FROM dbo.PayedMakeOvers p
    WHERE p.TransactionId = @id
    ORDER BY p.Id DESC
    OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
  `);

  const agg = payedAgg.recordset[0] || { payedRows: 0, supplyCount: 0 };
  const inferred = inferStage({
    payedRows: Number(agg.payedRows || 0),
    Key2: (header.Key2 as string | null) ?? null,
    Key3: (header.Key3 as string | null) ?? null,
  });

  const stageIndex = ARMAGHAN_STAGES.findIndex((s) => s.id === inferred.stage);

  const defTitle = (header.DefinitionTitle as string | null) || null;
  const defCode = (header.DefinitionCode as string | null) || null;
  const rawDesc = (header.Description as string | null) || null;
  const description =
    rawDesc && String(rawDesc).trim()
      ? rawDesc
      : defTitle
        ? `تعریف: ${defTitle}${defCode ? ` (${defCode})` : ""}`
        : null;

  const registrarId = (header.Registrar as string | null) || null;
  const registrarName = header.RegistrarName
    ? String(header.RegistrarName).trim() || null
    : null;

  const rawTitle = (header.Title as string | null) || defTitle;
  const titleFa = formatTxnTitleFa(rawTitle);

  return {
    header: {
      Id: Number(header.Id),
      Title: titleFa === "—" ? rawTitle : titleFa,
      Date: header.Date as string | null,
      Acceptor: (header.Acceptor as string | null) || null,
      Description: description,
      Registrar: registrarId,
      RegistrarName: registrarName,
      RegistrarLabel: resolveRegistrarLabel(registrarId, registrarName),
      RegistrationDateTime:
        (header.RegistrationDateTime as string | null) ||
        (header.DefinitionCreatedDateTime as string | null) ||
        null,
      Key1: (header.Key1 as string | null) || null,
      Key2: (header.Key2 as string | null) || null,
      Key3: (header.Key3 as string | null) || null,
      DefinitionId: header.DefinitionId != null ? Number(header.DefinitionId) : null,
      DefinitionTitle: defTitle,
      DefinitionSupplyLocationId:
        header.DefinitionSupplyLocationId != null
          ? Number(header.DefinitionSupplyLocationId)
          : null,
    },
    aggregates: {
      payedRows: Number(agg.payedRows || 0),
      supplyCount: Number(agg.supplyCount || 0),
      subsidySum: Number(agg.subsidySum || 0),
      minFromDate: agg.minFromDate ?? null,
      maxFromDate: agg.maxFromDate ?? null,
    },
    supplies: supplies.recordset as Array<{
      Id: number;
      Title: string;
      Keyword: string;
      cnt: number;
    }>,
    sampleRows: sample.recordset as Record<string, unknown>[],
    samplePage,
    samplePageSize,
    sampleTotal: Number(agg.payedRows || 0),
    sampleTotalPages: Math.max(
      1,
      Math.ceil(Number(agg.payedRows || 0) / samplePageSize),
    ),
    ...inferred,
    reachedStepIndex: Math.max(0, stageIndex),
    stages: ARMAGHAN_STAGES,
    readonly: true as const,
    note: "",
  };
}

export type ManagerVerdict =
  | "block_finance"
  | "ready_finance"
  | "registered_only"
  | "inconsistent"
  | "bank_done";

/** Per-transaction manager deviation checks (SELECT only). */
export async function getTransactionDeviations(id: number) {
  const detail = await getArmaghanTransactionDetail(id);
  if (!detail) return null;

  const hasCalc = detail.aggregates.payedRows > 0;
  const hasList = filled(detail.header.Key2);
  const hasBank = filled(detail.header.Key3);
  const supplyTitle = detail.supplies[0]?.Title || null;
  const supplyId = detail.supplies[0]?.Id ?? null;

  let verdict: ManagerVerdict = "registered_only";
  let verdictFa = "فقط ثبت شده";
  let recommendation = "هنوز محاسبه انجام نشده. ابتدا مرحله محاسبه را اجرا کنید.";

  if (hasCalc && !hasList) {
    verdict = "block_finance";
    verdictFa = "مسدود برای مالی — محاسبه بدون لیست";
    recommendation =
      "یارانه فقط بعد از تهیه لیست افراد به مالی داده می‌شود. الان محاسبه شده ولی لیست خالی است → به مالی تحویل ندهید؛ اول «تهیه لیست افراد» را انجام دهید.";
  } else if (hasList && !hasCalc) {
    verdict = "inconsistent";
    verdictFa = "ناسازگاری داده — لیست بدون محاسبه";
    recommendation =
      "لیست افراد پر است ولی ردیف محاسبه صفر است. قبل از هر اقدام مالی منبع داده را بررسی کنید.";
  } else if (hasList && hasCalc && hasBank) {
    verdict = "bank_done";
    verdictFa = "لیست + دیسکت بانک آماده";
    recommendation =
      "لیست افراد و دیسکت بانک هر دو آماده‌اند. ادامه معمولاً با واحد مالی است.";
  } else if (hasList && hasCalc) {
    verdict = "ready_finance";
    verdictFa = "آماده تحویل به واحد مالی";
    recommendation =
      "محاسبه و لیست افراد آماده‌اند. فایل/وضعیت را به مالی بسپارید. دیسکت بانک اختیاری است.";
  }

  const checks = [
    {
      id: "registered",
      title: "۱) تراکنش ثبت شده",
      ok: true,
      detail: `#${detail.header.Id} · ${detail.header.Title || "بدون عنوان"} · تاریخ ${formatFaDate(detail.header.Date)}`,
      severity: "info" as const,
    },
    {
      id: "type_supply",
      title: "۲) نوع / محل تأمین",
      ok: detail.supplies.length > 0,
      detail:
        detail.supplies.length > 0
          ? `SupplyLocationId=${supplyId} · ${supplyTitle} · ${detail.aggregates.supplyCount} محل`
          : "محل تأمین از روی PayedMakeOvers قابل استنباط نیست (هنوز محاسبه نشده)",
      severity: (detail.supplies.length > 0 ? "info" : "warn") as
        | "info"
        | "warn"
        | "critical",
    },
    {
      id: "calculated",
      title: "۳) محاسبه (PayedMakeOvers)",
      ok: hasCalc,
      detail: hasCalc
        ? `${detail.aggregates.payedRows.toLocaleString("en-US")} ردیف · جمع تقریبی یارانه ${detail.aggregates.subsidySum.toLocaleString("en-US")}`
        : "ردیفی در PayedMakeOvers نیست",
      severity: (hasCalc ? "info" : "warn") as "info" | "warn" | "critical",
    },
    {
      id: "list_key2",
      title: "۴) لیست افراد",
      ok: hasList,
      detail: hasList ? String(detail.header.Key2) : "لیست افراد خالی است",
      severity: (hasList ? "info" : hasCalc ? "critical" : "warn") as
        | "info"
        | "warn"
        | "critical",
    },
    {
      id: "calc_without_list",
      title: "انحراف: محاسبه بدون لیست",
      ok: !(hasCalc && !hasList),
      detail:
        hasCalc && !hasList
          ? "بحرانی — تا لیست افراد پر نشود نباید به مالی برود"
          : "مشکل نیست",
      severity: "critical" as const,
    },
    {
      id: "list_without_calc",
      title: "انحراف: لیست بدون محاسبه",
      ok: !(hasList && !hasCalc),
      detail:
        hasList && !hasCalc
          ? "لیست افراد با ردیف‌های محاسبه هم‌خوان نیست"
          : "مشکل نیست",
      severity: "warn" as const,
    },
    {
      id: "ready_finance",
      title: "۵) آماده تحویل مالی؟",
      ok: hasList && hasCalc,
      detail:
        hasList && hasCalc
          ? "بله — لیست آماده؛ ادامه با واحد مالی"
          : "خیر — شرایط تحویل برقرار نیست",
      severity: "info" as const,
    },
    {
      id: "bank_key3",
      title: "۶) دیسکت بانک",
      ok: hasBank,
      detail: hasBank
        ? String(detail.header.Key3)
        : "خالی — اختیاری؛ معمولاً با مالی است",
      severity: "info" as const,
    },
  ];

  const managerBrief = {
    transactionId: detail.header.Id,
    title: detail.header.Title,
    date: detail.header.Date,
    verdict,
    verdictFa,
    recommendation,
    facts: [
      `شناسه ارمغان: ${detail.header.Id}`,
      `عنوان: ${detail.header.Title || "—"}`,
      `تاریخ: ${detail.header.Date || "—"}`,
      supplyTitle
        ? `محل تأمین: #${supplyId} ${supplyTitle}`
        : "محل تأمین: نامشخص",
      `ردیف محاسبه: ${detail.aggregates.payedRows.toLocaleString("en-US")}`,
      `لیست افراد: ${hasList ? String(detail.header.Key2) : "خالی"}`,
      `دیسکت بانک: ${hasBank ? String(detail.header.Key3) : "خالی"}`,
    ],
    actionsAllowedInPanel: [
      "مشاهده مراحل",
      "اجرای گزارش بازرسی",
      ...(isLabDb() ? ["محاسبه", "علامت لیست / بانک"] : []),
    ],
    actionsForbiddenInPanel: ["تحویل به مالی بدون لیست"],
  };

  return {
    transactionId: id,
    deviations: detail.deviations,
    checks,
    managerBrief,
    readonly: true as const,
  };
}
