import sql from "mssql";
import { loadEnvLocal } from "./_load-env-local.mjs";

const env = loadEnvLocal(import.meta.url);

const pool = await sql.connect({
  server: env.PAYDISK_SQL_HOST,
  port: Number(env.PAYDISK_SQL_PORT || 1433),
  database: env.PAYDISK_SQL_DATABASE || "AmarDB",
  user: env.PAYDISK_SQL_USER,
  password: env.PAYDISK_SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: true },
  requestTimeout: 60000,
});

function section(title) {
  console.log(`\n======== ${title} ========`);
}

section("1) MakeOverTransactions status profile (یارانه)");
const moProfile = await pool.request().query(`
  SELECT
    COUNT(*) AS total,
    SUM(CASE WHEN Key2 IS NOT NULL AND LTRIM(RTRIM(Key2)) <> '' THEN 1 ELSE 0 END) AS with_person_list_Key2,
    SUM(CASE WHEN Key3 IS NOT NULL AND LTRIM(RTRIM(Key3)) <> '' THEN 1 ELSE 0 END) AS with_bank_disk_Key3,
    SUM(CASE WHEN (Key2 IS NULL OR LTRIM(RTRIM(Key2)) = '') AND (Key3 IS NULL OR LTRIM(RTRIM(Key3)) = '') THEN 1 ELSE 0 END) AS registered_only,
    SUM(CASE WHEN Key2 IS NOT NULL AND LTRIM(RTRIM(Key2)) <> '' AND (Key3 IS NULL OR LTRIM(RTRIM(Key3)) = '') THEN 1 ELSE 0 END) AS list_ready_no_bank,
    MIN(Id) AS minId,
    MAX(Id) AS maxId
  FROM dbo.MakeOverTransactions
`);
console.table(moProfile.recordset);

section("2) Latest 15 یارانه transactions");
const moLatest = await pool.request().query(`
  SELECT TOP 15
    Id, Title, Date,
    CASE WHEN Key2 IS NULL OR LTRIM(RTRIM(Key2)) = '' THEN N'—' ELSE N'YES' END AS HasList,
    CASE WHEN Key3 IS NULL OR LTRIM(RTRIM(Key3)) = '' THEN N'—' ELSE N'YES' END AS HasBankDisk,
    LEFT(ISNULL(Key2,''), 60) AS Key2Preview,
    Registrar
  FROM dbo.MakeOverTransactions
  ORDER BY Id DESC
`);
console.table(moLatest.recordset);

section("3) PayedMakeOvers volume by recent TransactionIds");
const pmo = await pool.request().query(`
  SELECT TOP 12
    p.TransactionId,
    t.Title,
    COUNT(*) AS rowCount,
    SUM(CAST(ISNULL(p.LocalSubsidy,0) AS float) + CAST(ISNULL(p.UniverseSubsidy,0) AS float)) AS subsidySum
  FROM dbo.PayedMakeOvers p
  LEFT JOIN dbo.MakeOverTransactions t ON t.Id = p.TransactionId
  WHERE p.TransactionId IN (SELECT TOP 20 Id FROM dbo.MakeOverTransactions ORDER BY Id DESC)
  GROUP BY p.TransactionId, t.Title
  ORDER BY p.TransactionId DESC
`);
console.table(pmo.recordset);

section("4) MakeOverSupplyLocation catalog (یارانه types)");
const supplies = await pool.request().query(`
  SELECT TOP 40 *
  FROM dbo.MakeOverSupplyLocation
  ORDER BY 1
`);
// print column names + compact rows
console.log("columns:", Object.keys(supplies.recordset[0] || {}));
console.table(
  supplies.recordset.map((r) => {
    const id = r.Id ?? r.MakeOverSupplyLocationId ?? r.id;
    const title = r.Title ?? r.Name ?? r.SupplyLocationTitle ?? r.MakeOverSupplyLocationTitle;
    return { Id: id, Title: title };
  }),
);

section("5) PayedTransaction profile (مستمری family)");
const ptCols = await pool.request().query(`
  SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME='PayedTransaction' ORDER BY ORDINAL_POSITION
`);
console.log(
  "PayedTransaction columns:",
  ptCols.recordset.map((c) => c.COLUMN_NAME).join(", "),
);

const ptLatest = await pool.request().query(`
  SELECT TOP 15 *
  FROM dbo.PayedTransaction
  ORDER BY Id DESC
`);
console.table(
  ptLatest.recordset.map((r) => ({
    Id: r.Id,
    Title: r.Title ?? r.Name ?? r.TransactionTitle,
    Ky: r.Ky,
    Year: r.Year,
    AcceptanceDateTime: r.AcceptanceDateTime,
    AcceptorUserId: r.AcceptorUserId,
    RegistrationDate: r.RegistrationDate ?? r.RegistrationDateTime,
    UserRegistrarId: r.UserRegistrarId,
  })),
);

section("6) PayedTransaction Ky distribution (manager Ky codes)");
const ky = await pool.request().query(`
  SELECT ISNULL(Ky, N'(null)') AS Ky, COUNT(*) AS cnt
  FROM dbo.PayedTransaction
  GROUP BY Ky
  ORDER BY COUNT(*) DESC
`);
console.table(ky.recordset);

section("7) PayedContinusPayment counts for latest accepted-looking transactions");
const pcp = await pool.request().query(`
  SELECT TOP 10
    p.TransactionId,
    t.Ky,
    t.Year,
    COUNT(*) AS payRows,
    SUM(CAST(p.Money AS float)) AS moneySum
  FROM dbo.PayedContinusPayment p
  INNER JOIN dbo.PayedTransaction t ON t.Id = p.TransactionId
  WHERE p.TransactionId IN (
    SELECT TOP 30 Id FROM dbo.PayedTransaction ORDER BY Id DESC
  )
  GROUP BY p.TransactionId, t.Ky, t.Year
  ORDER BY p.TransactionId DESC
`);
console.table(pcp.recordset);

section("8) Sample #835 / #831 detail vs manager handoff expectation");
for (const id of [835, 831, 818, 817]) {
  const t = await pool
    .request()
    .input("id", sql.Int, id)
    .query(`SELECT Id, Title, Date, Key2, Key3, Registrar FROM dbo.MakeOverTransactions WHERE Id=@id`);
  const cnt = await pool
    .request()
    .input("id", sql.Int, id)
    .query(`SELECT COUNT(*) AS n FROM dbo.PayedMakeOvers WHERE TransactionId=@id`);
  console.log({
    id,
    txn: t.recordset[0] || null,
    payedMakeOverRows: cnt.recordset[0]?.n,
    managerNext:
      !t.recordset[0]
        ? "missing"
        : t.recordset[0].Key2
          ? "list ready → finance can continue (bank disk optional in their system)"
          : cnt.recordset[0]?.n > 0
            ? "calculated rows exist but Key2 empty → list/diskette step incomplete"
            : "registered only → need Calculate then list → then finance",
  });
}

await pool.close();
console.log("\nDone (read-only).");
