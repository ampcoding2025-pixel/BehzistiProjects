import { getReadPool, sql } from "@/lib/db/pool";
import { ACTIVE_SUPPLY_LOCATIONS } from "@/lib/supply-locations";

export type DisketteReportFamily = "yarane" | "mostamari";

export type TxnScriptDef = {
  id: string;
  family: DisketteReportFamily;
  /** Ops-doc section title */
  titleFa: string;
  description: string;
  managerWhy: string;
  /** Optional SupplyLocationId filter hint for yarane */
  supplyLocationIds?: number[];
  /** mostamari Ky codes this script fits */
  kyCodes?: string[];
  defaultLimit: number;
  maxLimit: number;
  buildSql: (limit: number) => string;
  /** bind @TrId (and optional extras) */
  needsTrId: boolean;
};

function assertSelectOnly(query: string) {
  const q = query.replace(/\s+/g, " ").trim();
  const head = q.slice(0, 12).toUpperCase();
  if (!head.startsWith("SELECT") && !head.startsWith("WITH ")) {
    throw new Error("Only SELECT/WITH allowed");
  }
  const banned =
    /\b(INSERT|UPDATE|DELETE|MERGE|DROP|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE|INTO\s+#|INTO\s+\[?dbo|INTO\s+IT)\b/i;
  if (banned.test(q)) {
    throw new Error("Write/EXEC blocked — ops-doc Calculate/UPDATE stay outside this panel");
  }
}

/** Scripts remembered from ops Word doc — SELECT variants only. */
export const TXN_SCRIPTS: TxnScriptDef[] = [
  // —— یارانه (doc: مراحل تهیه دیسکت یارانه مراکز)
  {
    id: "yrn-header",
    family: "yarane",
    titleFa: "سند: یافتن تراکنش (MakeOverTransactions)",
    description: "معادل select * from MakeOverTransactions برای همین Id",
    managerWhy: "تایید عنوان/تاریخ/لیست افراد/دیسکت بانک قبل از هر تصمیم مالی",
    defaultLimit: 1,
    maxLimit: 1,
    needsTrId: true,
    buildSql: () => `
      SELECT Id, Title, Date, Registrar, RegistrationDateTime, Key1, Key2, Key3, Description, Acceptor
      FROM dbo.MakeOverTransactions
      WHERE Id = @TrId
    `,
  },
  {
    id: "yrn-count-payed",
    family: "yarane",
    titleFa: "سند: بررسی صحت محاسبه (COUNT PayedMakeOvers)",
    description: "select count(*) from PayedMakeOvers where TransactionId=@TrId",
    managerWhy: "اگر ۰ باشد محاسبه نشده؛ اگر >۰ و لیست افراد خالی → مسدود مالی",
    defaultLimit: 1,
    maxLimit: 1,
    needsTrId: true,
    buildSql: () => `
      SELECT COUNT(*) AS payedRows,
             COUNT(DISTINCT MakeOverSupplyLocationId) AS supplyCount
      FROM dbo.PayedMakeOvers
      WHERE TransactionId = @TrId
    `,
  },
  {
    id: "yrn-supply-breakdown",
    family: "yarane",
    titleFa: "سند: محل تأمین استفاده‌شده در محاسبه",
    description: "از روی PayedMakeOvers + MakeOverSupplyLocation (کدهای ۲،۳،۷،۸،۹،۲۵،۳۵،۳۹،۴۳،۵۰،۵۱،۶۶ و …)",
    managerWhy: "نوع دیسکت یارانه را با SupplyLocationId سند تطبیق می‌دهد",
    defaultLimit: 40,
    maxLimit: 80,
    needsTrId: true,
    buildSql: (limit) => `
      SELECT TOP (${limit})
        p.MakeOverSupplyLocationId AS SupplyLocationId,
        ISNULL(s.MakeOverSupplyLocationTitle, N'(نامشخص)') AS Title,
        ISNULL(s.MakeOverSuplyLocationKeyword, N'') AS Keyword,
        COUNT(*) AS cnt
      FROM dbo.PayedMakeOvers p
      LEFT JOIN dbo.MakeOverSupplyLocation s
        ON s.MakeOverSupplyLocationId = p.MakeOverSupplyLocationId
      WHERE p.TransactionId = @TrId
      GROUP BY p.MakeOverSupplyLocationId, s.MakeOverSupplyLocationTitle, s.MakeOverSuplyLocationKeyword
      ORDER BY COUNT(*) DESC
    `,
  },
  {
    id: "yrn-person-list",
    family: "yarane",
    titleFa: "سند: تهیه لیست افراد (SELECT جایگزین GetList)",
    description: "همان join سند برای TransactionId — فقط TOP برای بازرسی",
    managerWhy: "نمونه خروجی لیست قبل از تحویل مالی",
    defaultLimit: 50,
    maxLimit: 200,
    needsTrId: true,
    buildSql: (limit) => `
      SELECT TOP (${limit})
        PayedMakeOvers.Id, PayedMakeOvers.PersonId, PayedMakeOvers.CenterId,
        PayedMakeOvers.LocalSubsidy, PayedMakeOvers.UniverseSubsidy,
        PayedMakeOvers.IsNoName, PayedMakeOvers.IsSpecial, PayedMakeOvers.Mosharekat,
        PayedMakeOvers.CenterAccount, Person.FirstName, Person.LastName, Person.NID,
        Center.CenterTitle, City.CityTitle, Province.ProvinceTitle, Center.IBN,
        PayedMakeOvers.TransactionId, MakeOverTransactions.Title,
        PayedMakeOvers.MakeOverSupplyLocationId
      FROM dbo.Province
      INNER JOIN dbo.City ON Province.ProvinceId = City.ProvinceId
      INNER JOIN dbo.PayedMakeOvers
        INNER JOIN dbo.Person ON PayedMakeOvers.PersonId = Person.ID
        INNER JOIN dbo.Center ON PayedMakeOvers.CenterId = Center.CenterId
        ON City.CityId = Center.CityID
      INNER JOIN dbo.MakeOverTransactions ON PayedMakeOvers.TransactionId = MakeOverTransactions.Id
      WHERE PayedMakeOvers.TransactionId = @TrId
      ORDER BY PayedMakeOvers.Id DESC
    `,
  },
  {
    id: "yrn-gate-key2",
    family: "yarane",
    titleFa: "دروازه تحویل مالی (لیست افراد در برابر محاسبه)",
    description: "تشخیص انحراف محاسبه بدون لیست",
    managerWhy: "یارانه فقط بعد از لیست افراد به مالی؛ این گزارش حکم مدیر را می‌سازد",
    defaultLimit: 1,
    maxLimit: 1,
    needsTrId: true,
    buildSql: () => `
      SELECT
        t.Id, t.Title, t.Key2, t.Key3,
        ISNULL(p.cnt, 0) AS payedRows,
        CASE
          WHEN ISNULL(p.cnt,0) > 0 AND (t.Key2 IS NULL OR LTRIM(RTRIM(t.Key2))='')
            THEN N'BLOCK_FINANCE — محاسبه بدون لیست'
          WHEN ISNULL(p.cnt,0) > 0 AND t.Key2 IS NOT NULL AND LTRIM(RTRIM(t.Key2))<>''
            THEN N'READY_FINANCE — لیست آماده'
          WHEN ISNULL(p.cnt,0) = 0 AND t.Key2 IS NOT NULL AND LTRIM(RTRIM(t.Key2))<>''
            THEN N'INCONSISTENT — لیست بدون محاسبه'
          ELSE N'REGISTERED_ONLY — فقط ثبت'
        END AS managerVerdict
      FROM dbo.MakeOverTransactions t
      LEFT JOIN (
        SELECT TransactionId, COUNT(*) AS cnt FROM dbo.PayedMakeOvers GROUP BY TransactionId
      ) p ON p.TransactionId = t.Id
      WHERE t.Id = @TrId
    `,
  },

  // —— مشترک / کیفیت از سند
  {
    id: "ibn-duplicates",
    family: "mostamari",
    titleFa: "سند: حساب تکراری در IBN_AccountNumber",
    description: "WITH CTE … RN>1 — قبل از لیست حق پرستاری/امداد الزامی است",
    managerWhy: "حساب تکراری → پرداخت بیش از یکبار",
    defaultLimit: 50,
    maxLimit: 200,
    needsTrId: false,
    buildSql: (limit) => `
      WITH CTE AS (
        SELECT AccountNumber,
               RN = ROW_NUMBER() OVER (PARTITION BY AccountNumber ORDER BY AccountNumber)
        FROM dbo.IBN_AccountNumber
      )
      SELECT TOP (${limit}) AccountNumber, RN FROM CTE WHERE RN > 1
      ORDER BY AccountNumber, RN
    `,
  },
  {
    id: "mst-money-hist",
    family: "mostamari",
    titleFa: "سند: توزیع مبلغ مستمری (histogram)",
    description: "count(*), Money from PayedContinusPayment group by Money",
    managerWhy: "کنترل مبالغ نامتعارف قبل از اکسل",
    kyCodes: ["Mst_131500", "Mst_HDF", "Mst_Emdad", "Mst_PARASTARI", "Mst_F_PRSTRI"],
    defaultLimit: 100,
    maxLimit: 200,
    needsTrId: true,
    buildSql: () => `
      SELECT COUNT(*) AS cnt, Money
      FROM dbo.PayedContinusPayment
      WHERE TransactionId = @TrId
      GROUP BY Money
      ORDER BY Money DESC
    `,
  },
  {
    id: "mst-money-alive",
    family: "mostamari",
    titleFa: "سند: گزارش مستمری (IsDead=0)",
    description: "count + money where Person.IsDead=0",
    managerWhy: "همان گزارش سند برای افراد زنده",
    kyCodes: ["Mst_131500", "Mst_HDF"],
    defaultLimit: 100,
    maxLimit: 200,
    needsTrId: true,
    buildSql: () => `
      SELECT COUNT(*) AS cnt, r.Money
      FROM dbo.PayedContinusPayment AS r
      INNER JOIN dbo.Person AS p ON r.PersonId = p.ID
      WHERE r.TransactionId = @TrId AND p.IsDead = 0
      GROUP BY r.Money
      ORDER BY r.Money DESC
    `,
  },
  {
    id: "mst-nurse-emdad-list",
    family: "mostamari",
    titleFa: "سند: لیست حق پرستاری / امداد + شبا",
    description: "PayedContinusPayment join IBN — TransactionId سند",
    managerWhy: "خروجی اکسل پرداخت؛ NID باید text بماند",
    kyCodes: ["Mst_Emdad", "Mst_PARASTARI", "Mst_F_PRSTRI"],
    defaultLimit: 50,
    maxLimit: 200,
    needsTrId: true,
    buildSql: (limit) => `
      SELECT TOP (${limit})
        p.Id, p.PersonId, p.AccountNumber, p.Money, Person.NID, Person.FirstName, Person.LastName,
        Center.CenterTitle, City.CityTitle, Province.ProvinceTitle,
        LTRIM(RTRIM(i.IBN)) AS ibn
      FROM dbo.PayedContinusPayment AS p
      INNER JOIN dbo.Person ON p.PersonId = Person.ID
      INNER JOIN dbo.Center ON p.CenterRegistrarId = Center.CenterId
      INNER JOIN dbo.City ON Center.CityID = City.CityId
      INNER JOIN dbo.Province ON City.ProvinceId = Province.ProvinceId
      LEFT OUTER JOIN dbo.IBN_AccountNumber AS i
        ON LTRIM(RTRIM(p.AccountNumber)) = LTRIM(RTRIM(i.AccountNumber))
      WHERE p.TransactionId = @TrId
      ORDER BY ibn
    `,
  },
  {
    id: "mst-missing-ibn",
    family: "mostamari",
    titleFa: "سند: فاقد شبا در Join",
    description: "لیست پرداخت با IBN تهی — مانع دیسکت بانک/اکسل",
    managerWhy: "قبل از ارسال، شباهای جدید باید در IBN_AccountNumber بیایند",
    kyCodes: ["Mst_131500", "Mst_HDF", "Mst_Emdad", "Mst_PARASTARI", "Mst_F_PRSTRI"],
    defaultLimit: 50,
    maxLimit: 200,
    needsTrId: true,
    buildSql: (limit) => `
      SELECT TOP (${limit})
        p.Id, p.PersonId, p.AccountNumber, p.Money, Person.NID,
        Person.FirstName, Person.LastName, Center.CenterTitle, Province.ProvinceTitle
      FROM dbo.PayedContinusPayment AS p
      INNER JOIN dbo.Person ON p.PersonId = Person.ID
      INNER JOIN dbo.Center ON p.CenterRegistrarId = Center.CenterId
      INNER JOIN dbo.City ON Center.CityID = City.CityId
      INNER JOIN dbo.Province ON City.ProvinceId = Province.ProvinceId
      LEFT JOIN dbo.IBN_AccountNumber AS i
        ON LTRIM(RTRIM(p.AccountNumber)) = LTRIM(RTRIM(i.AccountNumber))
      WHERE p.TransactionId = @TrId
        AND (i.IBN IS NULL OR LTRIM(RTRIM(i.IBN)) = '' OR i.IBN = 'null')
      ORDER BY p.Id DESC
    `,
  },
];

export function getTxnScript(id: string) {
  return TXN_SCRIPTS.find((s) => s.id === id);
}

/** Map MakeOver supply id → suggested yarane script set + label. */
export function suggestYaraneType(supplyLocationId: number | null | undefined) {
  const hit = ACTIVE_SUPPLY_LOCATIONS.find((s) => s.id === supplyLocationId);
  return {
    supplyLocationId: supplyLocationId ?? null,
    titleFa: hit?.titleFa || (supplyLocationId ? `محل تأمین #${supplyLocationId}` : "نامشخص"),
    keyword: hit?.keyword || null,
    scriptIds: ["yrn-header", "yrn-count-payed", "yrn-supply-breakdown", "yrn-person-list", "yrn-gate-key2"],
  };
}

export function scriptsForFamily(family: DisketteReportFamily) {
  if (family === "yarane") {
    return TXN_SCRIPTS.filter((s) => s.family === "yarane");
  }
  return TXN_SCRIPTS.filter((s) => s.family === "mostamari" || s.id === "ibn-duplicates");
}

export async function runTxnScript(
  scriptId: string,
  opts: { trId?: number; limit?: number; page?: number; pageSize?: number },
) {
  const def = getTxnScript(scriptId);
  if (!def) throw new Error("Unknown script");
  if (def.needsTrId && (!opts.trId || opts.trId <= 0)) {
    throw new Error("TransactionId required for this ops-doc script");
  }

  const pageSize = Math.min(
    def.maxLimit,
    Math.max(
      1,
      Number(opts.pageSize) || Number(opts.limit) || def.defaultLimit,
    ),
  );
  const page = Math.max(1, Number(opts.page) || 1);
  const offset = (page - 1) * pageSize;
  const usePaging = def.maxLimit > 1;

  let text = def.buildSql(pageSize);
  if (usePaging && /TOP\s*\(/i.test(text)) {
    text = text.replace(/TOP\s*\(\s*\d+\s*\)/i, "");
    if (!/ORDER\s+BY/i.test(text)) {
      text = `${text.trim()}\n ORDER BY (SELECT NULL)`;
    }
    text = `${text.trim()}\n OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY`;
  }
  assertSelectOnly(text);

  const pool = await getReadPool();
  const req = pool.request();
  if (def.needsTrId) req.input("TrId", sql.Int, opts.trId!);
  const started = Date.now();
  const result = await req.query(text);
  const rows = (result.recordset || []) as Record<string, unknown>[];

  let total = rows.length;
  if (usePaging && def.needsTrId && opts.trId) {
    const countReq = pool.request();
    countReq.input("TrId", sql.Int, opts.trId);
    if (def.id === "yrn-person-list") {
      const c = await countReq.query(`
        SELECT COUNT(*) AS total FROM dbo.PayedMakeOvers WHERE TransactionId = @TrId
      `);
      total = Number(c.recordset[0]?.total || 0);
    } else if (
      def.id === "mst-nurse-emdad-list" ||
      def.id === "mst-missing-ibn"
    ) {
      const c = await countReq.query(`
        SELECT COUNT(*) AS total FROM dbo.PayedContinusPayment WHERE TransactionId = @TrId
      `);
      total = Number(c.recordset[0]?.total || 0);
    } else {
      // Aggregates / small result sets: page within fetched window
      total = offset + rows.length + (rows.length >= pageSize ? 1 : 0);
    }
  } else if (usePaging && !def.needsTrId) {
    total = offset + rows.length + (rows.length >= pageSize ? 1 : 0);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return {
    script: {
      id: def.id,
      titleFa: def.titleFa,
      description: def.description,
      managerWhy: def.managerWhy,
      family: def.family,
    },
    ms: Date.now() - started,
    columns: rows.length ? Object.keys(rows[0] as object) : [],
    rows,
    page,
    pageSize,
    total,
    totalPages,
    readonly: true as const,
    note: "",
  };
}
