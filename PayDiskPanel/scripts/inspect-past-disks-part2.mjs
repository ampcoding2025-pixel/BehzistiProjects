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
  requestTimeout: 90000,
});

function section(title) {
  console.log(`\n======== ${title} ========`);
}

section("3) PayedMakeOvers for recent txn ids");
const recentIds = await pool.request().query(`
  SELECT TOP 20 Id FROM dbo.MakeOverTransactions ORDER BY Id DESC
`);
const ids = recentIds.recordset.map((r) => Number(r.Id));
const pmo = await pool.request().query(`
  SELECT
    p.TransactionId,
    COUNT(*) AS nRows,
    SUM(CAST(ISNULL(p.LocalSubsidy,0) AS float) + CAST(ISNULL(p.UniverseSubsidy,0) AS float)) AS subsidySum
  FROM dbo.PayedMakeOvers p
  WHERE p.TransactionId IN (${ids.join(",")})
  GROUP BY p.TransactionId
  ORDER BY p.TransactionId DESC
`);
const titleMap = Object.fromEntries(
  (
    await pool.request().query(`
    SELECT Id, Title FROM dbo.MakeOverTransactions WHERE Id IN (${ids.join(",")})
  `)
  ).recordset.map((r) => [Number(r.Id), r.Title]),
);
console.table(
  pmo.recordset.map((r) => ({
    TransactionId: r.TransactionId,
    Title: titleMap[Number(r.TransactionId)]?.slice(0, 50),
    nRows: r.nRows,
    subsidySum: r.subsidySum,
  })),
);
const missingCalc = ids.filter((id) => !pmo.recordset.some((r) => Number(r.TransactionId) === id));
console.log("Recent txns with ZERO PayedMakeOvers rows:", missingCalc);

section("4) MakeOverSupplyLocation columns + rows");
const col = await pool.request().query(`
  SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME='MakeOverSupplyLocation' ORDER BY ORDINAL_POSITION
`);
console.log(col.recordset.map((c) => c.COLUMN_NAME).join(", "));
const supplies = await pool.request().query(`SELECT * FROM dbo.MakeOverSupplyLocation`);
console.table(
  supplies.recordset.map((r) => ({
    Id: r.Id ?? r.MakeOverSupplyLocationId,
    Title: r.Title ?? r.Name ?? r.MakeOverSupplyLocationTitle ?? r.SupplyLocationTitle,
  })),
);
console.log("Supply location count:", supplies.recordset.length);

section("5) PayedTransaction latest + Ky");
const ptCols = await pool.request().query(`
  SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME='PayedTransaction' ORDER BY ORDINAL_POSITION
`);
console.log(ptCols.recordset.map((c) => c.COLUMN_NAME).join(", "));

const ptLatest = await pool.request().query(`
  SELECT TOP 20 Id, Title, Ky, Year, AcceptanceDateTime, AcceptorUserId, RegistrationDate, UserRegistrarId
  FROM dbo.PayedTransaction
  ORDER BY Id DESC
`);
console.table(ptLatest.recordset);

const ky = await pool.request().query(`
  SELECT ISNULL(Ky, N'(null)') AS Ky, COUNT(*) AS cnt
  FROM dbo.PayedTransaction
  GROUP BY Ky
  ORDER BY COUNT(*) DESC
`);
console.table(ky.recordset);

section("6) PayedContinusPayment for latest 15 PayedTransaction ids");
const ptIds = (
  await pool.request().query(`SELECT TOP 15 Id FROM dbo.PayedTransaction ORDER BY Id DESC`)
).recordset.map((r) => Number(r.Id));
const pcp = await pool.request().query(`
  SELECT
    p.TransactionId,
    COUNT(*) AS nRows,
    SUM(CAST(p.Money AS float)) AS moneySum
  FROM dbo.PayedContinusPayment p
  WHERE p.TransactionId IN (${ptIds.join(",")})
  GROUP BY p.TransactionId
  ORDER BY p.TransactionId DESC
`);
const ptMeta = Object.fromEntries(
  (
    await pool.request().query(`
    SELECT Id, Title, Ky, Year FROM dbo.PayedTransaction WHERE Id IN (${ptIds.join(",")})
  `)
  ).recordset.map((r) => [Number(r.Id), r]),
);
console.table(
  ptIds.map((id) => {
    const meta = ptMeta[id] || {};
    const row = pcp.recordset.find((x) => Number(x.TransactionId) === id);
    return {
      TransactionId: id,
      Title: String(meta.Title || "").slice(0, 40),
      Ky: meta.Ky,
      Year: meta.Year,
      nRows: row?.nRows ?? 0,
      moneySum: row?.moneySum ?? 0,
    };
  }),
);

section("7) Spot-check manager-relevant cases");
for (const id of [835, 834, 831, 818, 817]) {
  const t = (
    await pool
      .request()
      .input("id", sql.Int, id)
      .query(`SELECT Id, Title, Date, Key2, Key3, Registrar FROM dbo.MakeOverTransactions WHERE Id=@id`)
  ).recordset[0];
  const n = (
    await pool
      .request()
      .input("id", sql.Int, id)
      .query(`SELECT COUNT(*) AS n FROM dbo.PayedMakeOvers WHERE TransactionId=@id`)
  ).recordset[0].n;
  let stage;
  if (!t) stage = "missing";
  else if (t.Key3) stage = "bank_disk_ready";
  else if (t.Key2) stage = "person_list_ready → finance handoff (matches manager)";
  else if (n > 0) stage = "PayedMakeOvers exist but Key2 empty → list export missing";
  else stage = "registered only → need Calculate + list before finance";
  console.log({
    id,
    title: t?.Title,
    payedRows: n,
    hasKey2: !!t?.Key2,
    hasKey3: !!t?.Key3,
    stage,
  });
}

section("8) How many distinct Title patterns (approx disk type variety)");
const titles = await pool.request().query(`
  SELECT TOP 40
    LEFT(Title, 40) AS titlePrefix,
    COUNT(*) AS cnt
  FROM dbo.MakeOverTransactions
  GROUP BY LEFT(Title, 40)
  ORDER BY COUNT(*) DESC
`);
console.table(titles.recordset);
console.log("Distinct title prefixes (top40 shown):", titles.recordset.length);
const distinct = await pool.request().query(`
  SELECT COUNT(DISTINCT Title) AS distinctTitles FROM dbo.MakeOverTransactions
`);
console.log(distinct.recordset[0]);

await pool.close();
console.log("\nDone (read-only).");
