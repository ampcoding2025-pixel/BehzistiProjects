import {
  getActiveDbLabel,
  getReadPool,
  getWritePool,
  sql,
  targetAllowsWrites,
} from "@/lib/db/pool";
import {
  mostamariBankFilename,
  writeMostamariArmaghanBankFile,
} from "@/lib/lab/mostamari-bank-export";
import { defaultLabBankFile, labExecProc } from "@/lib/lab/writes";
import {
  getMostamariType,
  inferMostamariType,
  type MostamariTypeId,
} from "@/lib/mostamari/types";
import { assertSqlProc } from "@/lib/worker/whitelist";

function requireLab() {
  if (!targetAllowsWrites()) {
    throw new Error(
      `Write/EXEC مستمری روی «${getActiveDbLabel()}» مجاز نیست — lab یا تولید (155) با دسترسی نوشتن`,
    );
  }
}

function clampPage(page: number) {
  return Math.max(1, Number(page) || 1);
}
function clampPageSize(pageSize: number, fallback = 10) {
  return Math.min(50, Math.max(5, Number(pageSize) || fallback));
}

async function resolveRegistrarUserId(username: string | null | undefined) {
  const uid = (username || "").trim();
  if (!uid) return null;
  const pool = await getReadPool();
  const req = pool.request();
  req.input("uid", sql.NVarChar, uid);
  const rs = await req.query(`
    SELECT TOP 1 ID FROM dbo.[User]
    WHERE LOWER(LTRIM(RTRIM(UserID))) = LOWER(@uid)
  `);
  const id = Number(rs.recordset[0]?.ID);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/**
 * Header for a PayedTransaction.
 * Avoid COUNT_BIG(PayedContinusPayment) by default — it times out after Calculate* on lab.
 * Use hasPayed (EXISTS) unless opts.countRows is true.
 */
export async function getMostamariTransaction(
  trId: number,
  opts?: { countRows?: boolean },
) {
  if (!Number.isFinite(trId) || trId <= 0) throw new Error("TransactionId نامعتبر");
  const pool = await getReadPool();
  const req = pool.request();
  req.timeout = 60_000;
  req.input("id", sql.Int, trId);
  const countExpr = opts?.countRows
    ? `ISNULL((
        SELECT COUNT_BIG(*) FROM dbo.PayedContinusPayment p WITH (NOLOCK)
        WHERE p.TransactionId = t.Id
      ), 0)`
    : `CASE WHEN EXISTS (
        SELECT 1 FROM dbo.PayedContinusPayment p WITH (NOLOCK)
        WHERE p.TransactionId = t.Id
      ) THEN 1 ELSE 0 END`;
  const rs = await req.query(`
    SELECT
      t.Id, t.Title, t.RegistrationDate, t.RelatedTo, t.UserRegistrarId, t.Description,
      t.Ky, t.Year, t.AcceptorUserId, t.AcceptanceDateTime,
      t.ListToken, t.FileName, t.ExportToken,
      ru.UserID AS Registrar,
      ${countExpr} AS payedRows
    FROM dbo.PayedTransaction t WITH (NOLOCK)
    LEFT JOIN dbo.[User] ru ON ru.ID = t.UserRegistrarId
    WHERE t.Id = @id
  `);
  const row = rs.recordset[0];
  if (!row) {
    throw new Error(
      "تراکنش مستمری در PayedTransaction یافت نشد — هدف دیتابیس (آزمایشی/155/157) را بررسی کنید",
    );
  }
  const ky = row.Ky != null ? String(row.Ky) : null;
  const title = (row.Title as string | null) || null;
  const description = (row.Description as string | null) || null;
  const inferred = inferMostamariType({ ky, title, description });
  const payedRows = Number(row.payedRows || 0);
  const registrationDate =
    (row.RegistrationDate as string | Date | null) || null;
  const relatedTo = (row.RelatedTo as string | Date | null) || null;
  return {
    ok: true as const,
    header: {
      Id: Number(row.Id),
      Title: title,
      RegistrationDate: registrationDate,
      RelatedTo: relatedTo,
      UserRegistrarId: row.UserRegistrarId != null ? Number(row.UserRegistrarId) : null,
      Registrar: (row.Registrar as string | null) || null,
      Description: description,
      Ky: ky,
      Year: row.Year != null ? String(row.Year) : null,
      AcceptorUserId: row.AcceptorUserId != null ? Number(row.AcceptorUserId) : null,
      AcceptanceDateTime: (row.AcceptanceDateTime as string | null) || null,
      ListToken: (row.ListToken as string | null) || null,
      FileName: (row.FileName as string | null) || null,
      ExportToken: (row.ExportToken as string | null) || null,
      payedRows,
      /** When countRows=false, payedRows is 0|1 presence only */
      payedRowsExact: !!opts?.countRows,
      typeId: inferred?.id || null,
      typeTitleFa: inferred?.titleFa || null,
      typeInferredFrom: ky
        ? ("ky" as const)
        : inferred
          ? ("title" as const)
          : null,
      approved: !!(row.AcceptorUserId || row.AcceptanceDateTime || row.Year),
      /** Period month from Year column when set (e.g. 140506). */
      yearMonth: row.Year != null ? String(row.Year).replace(/\D/g, "").slice(0, 6) : null,
    },
  };
}

/** INSERT PayedTransaction (lab). */
export async function labCreateMostamariTransaction(opts: {
  title: string;
  date: string; // YYYY-MM-DD
  username?: string | null;
  description?: string | null;
  typeId?: MostamariTypeId | null;
}) {
  requireLab();
  const title = opts.title.trim();
  if (!title) throw new Error("عنوان تراکنش لازم است");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.date)) {
    throw new Error("تاریخ باید به صورت YYYY-MM-DD باشد");
  }
  const type = opts.typeId ? getMostamariType(opts.typeId) : null;
  const registrarId = await resolveRegistrarUserId(opts.username);
  if (!registrarId) {
    throw new Error(
      "کاربر ثبت‌کننده در dbo.[User] یافت نشد — با همان UserID لاگین کنید",
    );
  }
  const description = (
    opts.description?.trim() ||
    type?.titleFa ||
    title
  ).slice(0, 500);
  const pool = await getWritePool();
  const started = Date.now();
  const req = pool.request();
  req.input("title", sql.NVarChar, title.slice(0, 100));
  req.input("date", sql.NVarChar, opts.date);
  req.input("desc", sql.NVarChar, description);
  req.input("uid", sql.BigInt, registrarId);

  // RelatedTo = دورهٔ پرداخت (NOT NULL date) — همان تاریخ تعریف تراکنش
  const result = await req.query(`
    INSERT INTO dbo.PayedTransaction (
      Title, RegistrationDate, UserRegistrarId, Description, RelatedTo,
      Ky, Year, AcceptorUserId, AcceptanceDateTime
    )
    OUTPUT INSERTED.Id, INSERTED.Title, INSERTED.RegistrationDate, INSERTED.RelatedTo
    VALUES (
      @title, CAST(@date AS date), @uid, @desc, CAST(@date AS date),
      NULL, NULL, NULL, NULL
    )
  `);
  const row = result.recordset[0];
  if (!row) throw new Error("ثبت تراکنش مستمری ناموفق");
  return {
    ok: true as const,
    action: "create" as const,
    trId: Number(row.Id),
    title: row.Title as string,
    date: row.RegistrationDate as string,
    typeId: type?.id || null,
    ms: Date.now() - started,
    message: `تراکنش مستمری #${row.Id} ثبت شد`,
  };
}

/** EXEC Calculate* for the selected mostamari type (lab). */
export async function labCalculateMostamari(trId: number, typeId: MostamariTypeId) {
  requireLab();
  const type = getMostamariType(typeId);
  if (!type) throw new Error("نوع مستمری نامعتبر");
  const exec = await labExecProc(type.proc, { trId });
  // Cheap EXISTS only — full COUNT right after Calculate* often times out on lab.
  let hasPayed = 0;
  try {
    const after = await getMostamariTransaction(trId, { countRows: false });
    hasPayed = after.header.payedRows > 0 ? 1 : 0;
  } catch {
    hasPayed = -1;
  }
  return {
    ...exec,
    action: "calculate" as const,
    typeId: type.id,
    ky: type.ky,
    payedRows: hasPayed > 0 ? 1 : 0,
    message:
      hasPayed > 0
        ? `${type.proc} finished in ${Math.round(exec.ms / 1000)}s — rows present (exact count on Report step)`
        : hasPayed < 0
          ? `${type.proc} finished — could not verify rows yet; open Report`
          : `${type.proc} finished but no PayedContinusPayment rows found yet`,
  };
}

/** Ops-doc IBN duplicate check (read-only, any DB) — fast HAVING, capped. */
export async function mostamariIbnDuplicates(limit = 50) {
  const pool = await getReadPool();
  const top = Math.min(100, Math.max(1, limit));
  const req = pool.request();
  req.timeout = 45_000;
  const rs = await req.query(`
    SELECT TOP (${top})
      AccountNumber,
      COUNT_BIG(*) AS dupCount
    FROM dbo.IBN_AccountNumber WITH (NOLOCK)
    GROUP BY AccountNumber
    HAVING COUNT_BIG(*) > 1
    ORDER BY COUNT_BIG(*) DESC, AccountNumber
  `);
  const rows = rs.recordset as Record<string, unknown>[];
  return {
    ok: true as const,
    columns: rows[0] ? Object.keys(rows[0]) : ["AccountNumber", "dupCount"],
    rows,
    total: rows.length,
    checked: true,
    message:
      rows.length > 0
        ? `${rows.length.toLocaleString("fa-IR")} حساب تکراری در نمونه — قبل از پرداخت رفع کنید`
        : "حساب تکراری یافت نشد",
  };
}

/**
 * Money report (ops «گزارش مستمری»).
 * Default = light (money groups only) — alive/sample are slow on large txns.
 */
export async function mostamariReview(
  trId: number,
  opts?: {
    page?: number;
    pageSize?: number;
    /** Include IsDead=0 breakdown (slower). */
    includeAlive?: boolean;
    /** Include paged person sample (slower). */
    includeSample?: boolean;
  },
) {
  const pool = await getReadPool();
  const header = await getMostamariTransaction(trId, { countRows: false });
  const page = clampPage(opts?.page ?? 1);
  const pageSize = clampPageSize(opts?.pageSize ?? 10, 10);
  const offset = (page - 1) * pageSize;
  const includeAlive = !!opts?.includeAlive;
  const includeSample = !!opts?.includeSample;

  const histReq = pool.request();
  histReq.timeout = 90_000;
  histReq.input("id", sql.Int, trId);
  const hist = await histReq.query(`
    SELECT COUNT_BIG(*) AS cnt, Money
    FROM dbo.PayedContinusPayment WITH (NOLOCK)
    WHERE TransactionId = @id
    GROUP BY Money
    ORDER BY Money DESC
  `);

  let aliveHistogram: Array<{ cnt: number; Money: number }> = [];
  if (includeAlive) {
    const aliveReq = pool.request();
    aliveReq.timeout = 90_000;
    aliveReq.input("id", sql.Int, trId);
    const alive = await aliveReq.query(`
      SELECT COUNT_BIG(*) AS cnt, r.Money
      FROM dbo.PayedContinusPayment AS r WITH (NOLOCK)
      INNER JOIN dbo.Person AS p WITH (NOLOCK) ON r.PersonId = p.ID
      WHERE r.TransactionId = @id AND p.IsDead = 0
      GROUP BY r.Money
      ORDER BY r.Money DESC
    `);
    aliveHistogram = alive.recordset as Array<{ cnt: number; Money: number }>;
  }

  let sampleRows: Record<string, unknown>[] = [];
  if (includeSample) {
    const sampleReq = pool.request();
    sampleReq.timeout = 60_000;
    sampleReq.input("id", sql.Int, trId);
    sampleReq.input("offset", sql.Int, offset);
    sampleReq.input("pageSize", sql.Int, pageSize);
    const sample = await sampleReq.query(`
      SELECT
        p.Id, p.PersonId, p.AccountNumber, p.Money, p.FamilyCount, p.SupplyLocationId,
        Person.NID, Person.FirstName, Person.LastName,
        Center.CenterTitle, City.CityTitle, Province.ProvinceTitle,
        LTRIM(RTRIM(i.IBN)) AS ibn
      FROM dbo.PayedContinusPayment AS p WITH (NOLOCK)
      INNER JOIN dbo.Person WITH (NOLOCK) ON p.PersonId = Person.ID
      INNER JOIN dbo.Center WITH (NOLOCK) ON p.CenterRegistrarId = Center.CenterId
      INNER JOIN dbo.City WITH (NOLOCK) ON Center.CityID = City.CityId
      INNER JOIN dbo.Province WITH (NOLOCK) ON City.ProvinceId = Province.ProvinceId
      LEFT OUTER JOIN dbo.IBN_AccountNumber AS i WITH (NOLOCK)
        ON LTRIM(RTRIM(p.AccountNumber)) = LTRIM(RTRIM(i.AccountNumber))
      WHERE p.TransactionId = @id
      ORDER BY p.Id DESC
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `);
    sampleRows = sample.recordset as Record<string, unknown>[];
  }

  const moneyHistogram = hist.recordset as Array<{ cnt: number; Money: number }>;
  const total = moneyHistogram.reduce((a, r) => a + Number(r.cnt || 0), 0);
  const totalPages = Math.max(1, Math.ceil(Math.max(total, 1) / pageSize) || 1);
  const ready = total > 0 || header.header.payedRows > 0;
  return {
    ok: true as const,
    trId,
    header: { ...header.header, payedRows: total || header.header.payedRows },
    moneyHistogram,
    aliveHistogram,
    sampleRows,
    page,
    pageSize,
    total,
    totalPages,
    readyToApprove: ready,
    message: ready
      ? `${total.toLocaleString("fa-IR")} ردیف محاسبه‌شده`
      : "هنوز ردیف محاسبه‌ای نیست — ابتدا محاسبه را اجرا کنید",
  };
}

/**
 * Exact row count for a pay list (can be slow on large lab tables).
 * Kept separate from paging so «بارگذاری لیست» is not blocked by COUNT_BIG.
 */
export async function mostamariPaymentListCount(trId: number) {
  if (!Number.isFinite(trId) || trId <= 0) throw new Error("TransactionId نامعتبر");
  const pool = await getReadPool();
  const countReq = pool.request();
  countReq.timeout = 120_000;
  countReq.input("id", sql.Int, trId);
  const countRs = await countReq.query(`
    SELECT COUNT_BIG(*) AS total
    FROM dbo.PayedContinusPayment WITH (NOLOCK)
    WHERE TransactionId = @id
  `);
  const total = Number(countRs.recordset[0]?.total || 0);
  return {
    ok: true as const,
    trId,
    total,
    message:
      total > 0
        ? `${total.toLocaleString("fa-IR")} ردیف پرداخت`
        : "ردیفی برای این تراکنش نیست",
  };
}

/**
 * Fast paged pay list — no COUNT_BIG (that made «بارگذاری لیست» hang on large txns).
 * Fetches pageSize+1 to detect hasMore; exact total via mostamariPaymentListCount.
 * Key pattern: page Ids first, then join Person/Center/IBN only for that page.
 */
export async function mostamariPaymentList(
  trId: number,
  opts?: { page?: number; pageSize?: number },
) {
  if (!Number.isFinite(trId) || trId <= 0) throw new Error("TransactionId نامعتبر");
  const page = clampPage(opts?.page ?? 1);
  const pageSize = clampPageSize(opts?.pageSize ?? 10, 10);
  const offset = (page - 1) * pageSize;
  const pool = await getReadPool();

  const listReq = pool.request();
  listReq.timeout = 60_000;
  listReq.input("id", sql.Int, trId);
  listReq.input("offset", sql.Int, offset);
  // One extra row → hasMore without a full table COUNT.
  listReq.input("fetchN", sql.Int, pageSize + 1);
  const listRs = await listReq.query(`
    ;WITH page_ids AS (
      SELECT p.Id
      FROM dbo.PayedContinusPayment AS p WITH (NOLOCK)
      WHERE p.TransactionId = @id
      ORDER BY p.Id DESC
      OFFSET @offset ROWS FETCH NEXT @fetchN ROWS ONLY
    )
    SELECT
      p.Id,
      p.PersonId,
      p.AccountNumber,
      p.Money,
      p.FamilyCount,
      p.SupplyLocationId,
      Person.NID,
      Person.FirstName,
      Person.LastName,
      Center.CenterTitle,
      City.CityTitle,
      Province.ProvinceTitle,
      LTRIM(RTRIM(i.IBN)) AS ibn
    FROM page_ids pid
    INNER JOIN dbo.PayedContinusPayment AS p WITH (NOLOCK) ON p.Id = pid.Id
    INNER JOIN dbo.Person WITH (NOLOCK) ON p.PersonId = Person.ID
    INNER JOIN dbo.Center WITH (NOLOCK) ON p.CenterRegistrarId = Center.CenterId
    INNER JOIN dbo.City WITH (NOLOCK) ON Center.CityID = City.CityId
    INNER JOIN dbo.Province WITH (NOLOCK) ON City.ProvinceId = Province.ProvinceId
    LEFT JOIN dbo.IBN_AccountNumber AS i WITH (NOLOCK)
      ON i.AccountNumber = p.AccountNumber
    ORDER BY p.Id DESC
  `);

  const fetched = listRs.recordset as Record<string, unknown>[];
  const hasMore = fetched.length > pageSize;
  const rows = hasMore ? fetched.slice(0, pageSize) : fetched;
  // Enough pages to navigate next; exact total arrives from list-count.
  const totalPages = hasMore ? page + 1 : Math.max(1, page);
  const minKnown = offset + rows.length;

  return {
    ok: true as const,
    trId,
    page,
    pageSize,
    hasMore,
    /** Exact total unknown until list-count; minKnown for UI fallback. */
    totalExact: false as const,
    total: minKnown,
    totalPages,
    columns: rows[0] ? Object.keys(rows[0]) : [],
    rows,
    message:
      rows.length > 0
        ? `صفحه ${page.toLocaleString("fa-IR")} — ${rows.length.toLocaleString("fa-IR")} ردیف (شمارش کل در پس‌زمینه)`
        : page > 1
          ? "صفحه خالی است"
          : "ردیفی برای این تراکنش نیست — ابتدا محاسبه را انجام دهید",
  };
}

/** Read-only: people in A not in B (ops pair-sync preview). */
export async function mostamariPairDiff(
  trId: number,
  peerTrId: number,
  limit = 30,
) {
  if (!Number.isFinite(trId) || trId <= 0 || !Number.isFinite(peerTrId) || peerTrId <= 0) {
    throw new Error("Both transaction ids are required");
  }
  if (trId === peerTrId) throw new Error("Pair ids must differ");
  const top = Math.min(100, Math.max(5, limit));
  const pool = await getReadPool();

  const onlyA = await pool
    .request()
    .input("a", sql.Int, trId)
    .input("b", sql.Int, peerTrId)
    .query(`
      SELECT TOP (${top})
        p.Id, p.PersonId, p.Money, p.FamilyCount, p.TransactionId, Person.NID
      FROM dbo.PayedContinusPayment AS p WITH (NOLOCK)
      INNER JOIN dbo.Person WITH (NOLOCK) ON p.PersonId = Person.ID
      WHERE p.TransactionId = @a
        AND p.PersonId NOT IN (
          SELECT PersonId FROM dbo.PayedContinusPayment WITH (NOLOCK)
          WHERE TransactionId = @b
        )
      ORDER BY p.Id DESC
    `);

  const onlyB = await pool
    .request()
    .input("a", sql.Int, trId)
    .input("b", sql.Int, peerTrId)
    .query(`
      SELECT TOP (${top})
        p.Id, p.PersonId, p.Money, p.FamilyCount, p.TransactionId, Person.NID
      FROM dbo.PayedContinusPayment AS p WITH (NOLOCK)
      INNER JOIN dbo.Person WITH (NOLOCK) ON p.PersonId = Person.ID
      WHERE p.TransactionId = @b
        AND p.PersonId NOT IN (
          SELECT PersonId FROM dbo.PayedContinusPayment WITH (NOLOCK)
          WHERE TransactionId = @a
        )
      ORDER BY p.Id DESC
    `);

  const moneyMismatch = await pool
    .request()
    .input("a", sql.Int, trId)
    .input("b", sql.Int, peerTrId)
    .query(`
      SELECT TOP (${top})
        pa.PersonId, Person.NID, pa.Money AS MoneyA, pb.Money AS MoneyB,
        pa.Id AS IdA, pb.Id AS IdB
      FROM dbo.PayedContinusPayment AS pa WITH (NOLOCK)
      INNER JOIN dbo.PayedContinusPayment AS pb WITH (NOLOCK)
        ON pa.PersonId = pb.PersonId
      INNER JOIN dbo.Person WITH (NOLOCK) ON pa.PersonId = Person.ID
      WHERE pa.TransactionId = @a AND pb.TransactionId = @b
        AND pa.Money <> pb.Money
      ORDER BY Person.NID
    `);

  const onlyARows = onlyA.recordset as Record<string, unknown>[];
  const onlyBRows = onlyB.recordset as Record<string, unknown>[];
  const mismatchRows = moneyMismatch.recordset as Record<string, unknown>[];

  return {
    ok: true as const,
    trId,
    peerTrId,
    onlyInTrId: onlyARows,
    onlyInPeer: onlyBRows,
    moneyMismatch: mismatchRows,
    summary: {
      onlyInTrIdSample: onlyARows.length,
      onlyInPeerSample: onlyBRows.length,
      moneyMismatchSample: mismatchRows.length,
    },
    message:
      onlyARows.length || onlyBRows.length || mismatchRows.length
        ? `Diffs found (samples) — A∖B=${onlyARows.length}, B∖A=${onlyBRows.length}, money≠=${mismatchRows.length}. Bulk DELETE is manual/lab after hours.`
        : "No sample diffs in TOP N — lists look aligned (verify full counts offline).",
    deleteNote:
      "Ops DELETE templates stay outside the wizard. Align after business hours to reduce race with live register/approve.",
  };
}

/** Sample rows missing Sheba (bank disk prep). */
export async function mostamariMissingIbn(trId: number, limit = 40) {
  if (!Number.isFinite(trId) || trId <= 0) throw new Error("TransactionId invalid");
  const top = Math.min(100, Math.max(5, limit));
  const pool = await getReadPool();
  const rs = await pool
    .request()
    .input("id", sql.Int, trId)
    .query(`
      SELECT TOP (${top})
        p.Id, p.PersonId, p.AccountNumber, p.Money, Person.NID,
        Person.FirstName, Person.LastName, Center.CenterTitle, Province.ProvinceTitle
      FROM dbo.PayedContinusPayment AS p WITH (NOLOCK)
      INNER JOIN dbo.Person WITH (NOLOCK) ON p.PersonId = Person.ID
      INNER JOIN dbo.Center WITH (NOLOCK) ON p.CenterRegistrarId = Center.CenterId
      INNER JOIN dbo.City WITH (NOLOCK) ON Center.CityID = City.CityId
      INNER JOIN dbo.Province WITH (NOLOCK) ON City.ProvinceId = Province.ProvinceId
      LEFT JOIN dbo.IBN_AccountNumber AS i WITH (NOLOCK)
        ON LTRIM(RTRIM(p.AccountNumber)) = LTRIM(RTRIM(i.AccountNumber))
      WHERE p.TransactionId = @id
        AND (i.IBN IS NULL OR LTRIM(RTRIM(i.IBN)) = N'' OR i.IBN = N'null')
      ORDER BY p.Id DESC
    `);
  const rows = rs.recordset as Record<string, unknown>[];
  return {
    ok: true as const,
    trId,
    rows,
    totalSample: rows.length,
    columns: rows[0] ? Object.keys(rows[0]) : [],
    message:
      rows.length > 0
        ? `${rows.length.toLocaleString("fa-IR")} ردیف فاقد شبا در نمونه`
        : "در این نمونه فاقد شبا نیست",
    chunkNote: null,
  };
}

/**
 * Build Armaghan bank diskette for مستمری (same as dbo.Export):
 * 1) write fixed-width file to Diskette UNC + SET FileName
 * 2) fallback EXEC dbo.Export @name, @transactionId
 */
export async function labExportMostamariBank(trId: number, fileName?: string) {
  requireLab();
  if (!Number.isFinite(trId) || trId <= 0) throw new Error("TransactionId نامعتبر");
  const name =
    (fileName && fileName.trim()) ||
    mostamariBankFilename(trId) ||
    defaultLabBankFile(trId);
  const started = Date.now();
  const errors: string[] = [];

  try {
    const written = await writeMostamariArmaghanBankFile(trId, name);
    const pool = await getWritePool();
    const req = pool.request();
    req.input("id", sql.Int, trId);
    req.input("name", sql.NVarChar(100), name.slice(0, 100));
    await req.query(`
      UPDATE dbo.PayedTransaction
      SET FileName = @name
      WHERE Id = @id
    `);
    return {
      ok: true as const,
      action: "bank_export" as const,
      trId,
      fileName: name,
      uncPath: written.uncPath,
      bytes: written.bytes,
      via: "unc" as const,
      ms: Date.now() - started,
      message: `دیسکت بانک ارمغان نوشته شد — FileName=${name}`,
    };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  try {
    assertSqlProc("Export");
    await labExecProc("Export", { trId });
    // labExecProc uses defaultLabBankFile — read FileName back
    const after = await getMostamariTransaction(trId, { countRows: false });
    const fn = after.header.FileName || defaultLabBankFile(trId);
    return {
      ok: true as const,
      action: "bank_export" as const,
      trId,
      fileName: fn,
      uncPath: null as string | null,
      bytes: null as number | null,
      via: "sp" as const,
      ms: Date.now() - started,
      message: `دیسکت بانک با dbo.Export ساخته شد — FileName=${fn}`,
      warnings: errors,
    };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  throw new Error(
    `ساخت دیسکت بانک ناموفق:\n۱) UNC: ${errors[0] || "—"}\n۲) dbo.Export: ${errors[1] || "—"}`,
  );
}

/**
 * Approve / confirm paid mostamari (ops doc):
 * SET Ky, Year (YYYYMM), AcceptorUserId, AcceptanceDateTime
 * Cancelled: only Ky=CANCELLED.
 */
export async function labApproveMostamari(opts: {
  trId: number;
  typeId: MostamariTypeId | "cancelled";
  yearMonth: string; // YYYYMM e.g. 140401
  username?: string | null;
  cancelled?: boolean;
}) {
  requireLab();
  const trId = opts.trId;
  if (!Number.isFinite(trId) || trId <= 0) throw new Error("TransactionId نامعتبر");

  const cancelled = !!opts.cancelled || opts.typeId === "cancelled";
  const type = cancelled ? null : getMostamariType(opts.typeId as MostamariTypeId);
  if (!cancelled && !type) throw new Error("نوع مستمری نامعتبر");

  const yearMonth = String(opts.yearMonth || "").trim();
  if (!cancelled && !/^\d{6}$/.test(yearMonth)) {
    throw new Error("سال/ماه باید به صورت YYYYMM باشد (مثال ۱۴۰۴۰۱ → 140401)");
  }

  if (!cancelled) {
    const gate = await getMostamariTransaction(trId, { countRows: false });
    if (gate.header.payedRows <= 0) {
      throw new Error("Cannot approve — no PayedContinusPayment rows for this TrId");
    }
  }

  const pool = await getWritePool();
  const started = Date.now();
  const req = pool.request();
  req.input("id", sql.Int, trId);

  if (cancelled) {
    req.input("ky", sql.NVarChar, "CANCELLED");
    await req.query(`
      UPDATE dbo.PayedTransaction
      SET Ky = @ky,
          Year = NULL,
          AcceptorUserId = NULL,
          AcceptanceDateTime = NULL
      WHERE Id = @id
    `);
    return {
      ok: true as const,
      action: "cancel" as const,
      trId,
      ky: "CANCELLED",
      ms: Date.now() - started,
      message: `تراکنش #${trId} با Ky=CANCELLED علامت خورد`,
    };
  }

  const registrarId = await resolveRegistrarUserId(opts.username);
  req.input("ky", sql.NVarChar, type!.ky);
  req.input("year", sql.NVarChar, yearMonth);
  req.input("acceptor", sql.Int, registrarId);
  await req.query(`
    UPDATE dbo.PayedTransaction
    SET Ky = @ky,
        Year = @year,
        AcceptorUserId = ISNULL(@acceptor, UserRegistrarId),
        AcceptanceDateTime = ISNULL(RegistrationDate, GETDATE())
    WHERE Id = @id
  `);

  let bankFileName: string | null = null;
  let bankVia: "unc" | "sp" | null = null;
  let bankWarning: string | null = null;
  try {
    const bank = await labExportMostamariBank(trId);
    bankFileName = bank.fileName || null;
    bankVia = bank.via;
  } catch (err) {
    bankWarning = err instanceof Error ? err.message : String(err);
  }

  return {
    ok: true as const,
    action: "approve" as const,
    trId,
    ky: type!.ky,
    yearMonth,
    fileName: bankFileName,
    bankVia,
    ms: Date.now() - started,
    message: bankFileName
      ? `تایید شد — Ky=${type!.ky} · Year=${yearMonth} · دیسکت بانک=${bankFileName}`
      : `تایید شد — Ky=${type!.ky} · Year=${yearMonth}`,
    bankWarning,
  };
}
