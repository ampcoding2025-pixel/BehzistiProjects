import { getReadPool, sql } from "@/lib/db/pool";
import { getReport } from "./catalog";

export type ReportParams = Record<string, string | undefined>;

function assertSelectOnly(query: string) {
  const q = query.replace(/\s+/g, " ").trim();
  const head = q.slice(0, 12).toUpperCase();
  if (!head.startsWith("SELECT") && !head.startsWith("WITH ")) {
    throw new Error("Only SELECT/WITH reports are allowed");
  }
  const banned =
    /\b(INSERT|UPDATE|DELETE|MERGE|DROP|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE|INTO\s+#|INTO\s+\[?dbo|INTO\s+IT)\b/i;
  if (banned.test(q)) {
    throw new Error("Write/EXEC statements are blocked in report runner");
  }
}

function lim(v: string | undefined, fallback = 50, max = 200) {
  const n = Number(v || fallback);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(1, Math.floor(n)));
}

function dateOrNull(v: string | undefined) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

type BindableRequest = {
  input: (name: string, type: unknown, value?: unknown) => unknown;
  query: (text: string) => Promise<{ recordset?: Record<string, unknown>[] }>;
};

async function query(label: string, text: string, bind?: (r: BindableRequest) => void) {
  assertSelectOnly(text);
  const pool = await getReadPool();
  const req = pool.request() as unknown as BindableRequest;
  if (bind) bind(req);
  const started = Date.now();
  const result = await req.query(text);
  return {
    label,
    ms: Date.now() - started,
    columns: result.recordset?.length ? Object.keys(result.recordset[0] as object) : [],
    rows: (result.recordset || []) as Record<string, unknown>[],
  };
}

export async function runReport(id: string, params: ReportParams) {
  const def = getReport(id);
  if (!def) throw new Error("Unknown report");

  const from = dateOrNull(params.from);
  const to = dateOrNull(params.to);
  const limit = lim(params.limit);

  switch (id) {
    case "yarane-pipeline-summary":
      return query(
        def.title,
        `
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN (t.Key2 IS NULL OR LTRIM(RTRIM(t.Key2))='')
                    AND ISNULL(p.cnt, 0) = 0
               THEN 1 ELSE 0 END) AS registered_only,
          SUM(CASE WHEN ISNULL(p.cnt, 0) > 0
                    AND (t.Key2 IS NULL OR LTRIM(RTRIM(t.Key2))='')
               THEN 1 ELSE 0 END) AS calc_no_list,
          SUM(CASE WHEN t.Key2 IS NOT NULL AND LTRIM(RTRIM(t.Key2))<>'' THEN 1 ELSE 0 END) AS list_ready,
          SUM(CASE WHEN t.Key3 IS NOT NULL AND LTRIM(RTRIM(t.Key3))<>'' THEN 1 ELSE 0 END) AS bank_disk_key3
        FROM dbo.MakeOverTransactions t
        LEFT JOIN (
          SELECT TransactionId, COUNT(*) AS cnt
          FROM dbo.PayedMakeOvers
          GROUP BY TransactionId
        ) p ON p.TransactionId = t.Id
        WHERE (@from IS NULL OR t.Date >= @from)
          AND (@to IS NULL OR t.Date < DATEADD(day, 1, @to))
        `,
        (r) => {
          r.input("from", sql.DateTime, from);
          r.input("to", sql.DateTime, to);
        },
      );

    case "yarane-calc-no-list":
      return query(
        def.title,
        `
        SELECT TOP (${limit})
          t.Id, t.Title, t.Date, t.Registrar,
          (SELECT COUNT(*) FROM dbo.PayedMakeOvers p WHERE p.TransactionId=t.Id) AS payedRows,
          N'نیاز به تهیه لیست افراد قبل از تحویل مالی' AS recommendation
        FROM dbo.MakeOverTransactions t
        WHERE EXISTS (SELECT 1 FROM dbo.PayedMakeOvers p WHERE p.TransactionId=t.Id)
          AND (t.Key2 IS NULL OR LTRIM(RTRIM(t.Key2))='')
          AND (@from IS NULL OR t.Date >= @from)
          AND (@to IS NULL OR t.Date < DATEADD(day, 1, @to))
        ORDER BY t.Id DESC
        `,
        (r) => {
          r.input("from", sql.DateTime, from);
          r.input("to", sql.DateTime, to);
        },
      );

    case "yarane-list-no-calc":
      return query(
        def.title,
        `
        SELECT TOP (${limit})
          t.Id, t.Title, t.Date, t.Key2, t.Registrar,
          N'لیست افراد بدون ردیف محاسبه — ناسازگاری' AS recommendation
        FROM dbo.MakeOverTransactions t
        LEFT JOIN dbo.PayedMakeOvers p ON p.TransactionId = t.Id
        WHERE t.Key2 IS NOT NULL AND LTRIM(RTRIM(t.Key2))<>''
          AND p.TransactionId IS NULL
          AND (@from IS NULL OR t.Date >= @from)
          AND (@to IS NULL OR t.Date < DATEADD(day, 1, @to))
        ORDER BY t.Id DESC
        `,
        (r) => {
          r.input("from", sql.DateTime, from);
          r.input("to", sql.DateTime, to);
        },
      );

    case "yarane-registered-only":
      return query(
        def.title,
        `
        SELECT TOP (${limit})
          t.Id, t.Title, t.Date, t.Registrar,
          N'نیاز به Calculate سپس لیست' AS recommendation
        FROM dbo.MakeOverTransactions t
        WHERE (t.Key2 IS NULL OR LTRIM(RTRIM(t.Key2))='')
          AND NOT EXISTS (SELECT 1 FROM dbo.PayedMakeOvers p WHERE p.TransactionId=t.Id)
          AND (@from IS NULL OR t.Date >= @from)
          AND (@to IS NULL OR t.Date < DATEADD(day, 1, @to))
        ORDER BY t.Id DESC
        `,
        (r) => {
          r.input("from", sql.DateTime, from);
          r.input("to", sql.DateTime, to);
        },
      );

    case "yarane-ready-for-finance":
      return query(
        def.title,
        `
        SELECT TOP (${limit})
          t.Id, t.Title, t.Date, t.Key2, t.Registrar,
          (SELECT COUNT(*) FROM dbo.PayedMakeOvers p WHERE p.TransactionId=t.Id) AS payedRows,
          N'آماده اعلام به مالی (دیسکت بانک لازم نیست)' AS recommendation
        FROM dbo.MakeOverTransactions t
        WHERE t.Key2 IS NOT NULL AND LTRIM(RTRIM(t.Key2))<>''
          AND (@from IS NULL OR t.Date >= @from)
          AND (@to IS NULL OR t.Date < DATEADD(day, 1, @to))
        ORDER BY t.Id DESC
        `,
        (r) => {
          r.input("from", sql.DateTime, from);
          r.input("to", sql.DateTime, to);
        },
      );

    case "yarane-supply-catalog":
      return query(
        def.title,
        `
        SELECT MakeOverSupplyLocationId AS Id,
               MakeOverSupplyLocationTitle AS Title,
               MakeOverSuplyLocationKeyword AS Keyword,
               GroupId, Budget
        FROM dbo.MakeOverSupplyLocation
        ORDER BY MakeOverSupplyLocationId
        `,
      );

    case "mostamari-unconfirmed":
      return query(
        def.title,
        `
        SELECT TOP (${limit})
          t.Id, t.Title, t.Ky, t.Year, t.RegistrationDate, t.UserRegistrarId,
          (SELECT COUNT(*) FROM dbo.PayedContinusPayment p WHERE p.TransactionId=t.Id) AS payRows,
          N'طبق سند: ثبت Ky و Year پس از پرداخت' AS recommendation
        FROM dbo.PayedTransaction t
        WHERE (t.Ky IS NULL OR t.Year IS NULL)
          AND EXISTS (SELECT 1 FROM dbo.PayedContinusPayment p WHERE p.TransactionId=t.Id)
          AND (@from IS NULL OR t.RegistrationDate >= @from)
          AND (@to IS NULL OR t.RegistrationDate < DATEADD(day, 1, @to))
        ORDER BY t.Id DESC
        `,
        (r) => {
          r.input("from", sql.DateTime, from);
          r.input("to", sql.DateTime, to);
        },
      );

    case "mostamari-ky-distribution":
      return query(
        def.title,
        `
        SELECT ISNULL(Ky, N'(null)') AS Ky, COUNT(*) AS cnt
        FROM dbo.PayedTransaction
        GROUP BY Ky
        ORDER BY COUNT(*) DESC
        `,
      );

    case "mostamari-money-histogram": {
      let tid = Number(params.transactionId || 0);
      if (!tid) {
        const pool = await getReadPool();
        const latest = await pool.request().query(`
          SELECT TOP 1 Id FROM dbo.PayedTransaction
          WHERE Title LIKE N'%مستمری%'
          ORDER BY Id DESC
        `);
        tid = Number(latest.recordset[0]?.Id || 0);
      }
      if (!tid) throw new Error("No مستمری transaction found");
      return query(
        `${def.title} · TrId=${tid}`,
        `
        SELECT COUNT(*) AS cnt, Money
        FROM dbo.PayedContinusPayment
        WHERE TransactionId = @tid
        GROUP BY Money
        ORDER BY Money DESC
        `,
        (r) => r.input("tid", sql.Int, tid),
      );
    }

    case "mostamari-missing-ibn": {
      let tid = Number(params.transactionId || 0);
      if (!tid) {
        const pool = await getReadPool();
        const latest = await pool.request().query(`
          SELECT TOP 1 Id FROM dbo.PayedTransaction
          WHERE Ky IS NOT NULL
          ORDER BY Id DESC
        `);
        tid = Number(latest.recordset[0]?.Id || 0);
      }
      if (!tid) throw new Error("No transaction id");
      return query(
        `${def.title} · TrId=${tid}`,
        `
        SELECT TOP (${limit})
          p.Id, p.PersonId, p.AccountNumber, p.Money, Person.NID,
          Person.FirstName, Person.LastName, Center.CenterTitle,
          Province.ProvinceTitle,
          N'فاقد شبا در Join — جداسازی طبق سند' AS recommendation
        FROM dbo.PayedContinusPayment AS p
        INNER JOIN dbo.Person ON p.PersonId = Person.ID
        INNER JOIN dbo.Center ON p.CenterRegistrarId = Center.CenterId
        INNER JOIN dbo.City ON Center.CityID = City.CityId
        INNER JOIN dbo.Province ON City.ProvinceId = Province.ProvinceId
        LEFT JOIN dbo.IBN_AccountNumber AS i
          ON LTRIM(RTRIM(p.AccountNumber)) = LTRIM(RTRIM(i.AccountNumber))
        WHERE p.TransactionId = @tid
          AND (i.IBN IS NULL OR LTRIM(RTRIM(i.IBN)) = '' OR i.IBN = 'null')
        ORDER BY p.Id DESC
        `,
        (r) => r.input("tid", sql.Int, tid),
      );
    }

    case "ibn-duplicates":
      return query(
        def.title,
        `
        WITH CTE AS (
          SELECT AccountNumber,
                 RN = ROW_NUMBER() OVER (PARTITION BY AccountNumber ORDER BY AccountNumber)
          FROM dbo.IBN_AccountNumber
        )
        SELECT TOP (${limit}) AccountNumber, RN
        FROM CTE
        WHERE RN > 1
        ORDER BY AccountNumber, RN
        `,
      );

    case "txn-person-diff": {
      const a = Number(params.transactionIdA);
      const b = Number(params.transactionIdB);
      if (!a || !b) throw new Error("transactionIdA and transactionIdB are required");
      return query(
        `${def.title} · ${a} \\ ${b}`,
        `
        SELECT TOP (${limit})
          PayedContinusPayment.Id, PayedContinusPayment.PersonId,
          PayedContinusPayment.FamilyCount, PayedContinusPayment.SupplyLocationId,
          PayedContinusPayment.Money, PayedContinusPayment.TransactionId, Person.NID,
          N'فقط گزارش اختلاف — بدون حذف' AS recommendation
        FROM dbo.PayedContinusPayment
        INNER JOIN dbo.Person ON PayedContinusPayment.PersonId = Person.ID
        WHERE PayedContinusPayment.TransactionId = @A
          AND PayedContinusPayment.PersonId NOT IN (
            SELECT PersonId FROM dbo.PayedContinusPayment WHERE TransactionId = @B
          )
        ORDER BY PayedContinusPayment.Id
        `,
        (r) => {
          r.input("A", sql.Int, a);
          r.input("B", sql.Int, b);
        },
      );
    }

    default:
      throw new Error("Report not implemented");
  }
}
