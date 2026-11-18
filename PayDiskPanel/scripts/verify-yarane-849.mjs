/**
 * Read-only: compare panel yarane queries vs ops-doc COUNT for MakeOver txn 849 on 155.
 */
import sql from "mssql";
import { loadEnvLocal } from "./_load-env-local.mjs";

const env = loadEnvLocal(import.meta.url);
const host = env.PAYDISK_SQL_HOST || "10.1.0.155";
const database = env.PAYDISK_SQL_PROD_DATABASE || "DB_Mostamary";
const trId = Number(process.argv[2] || 849);

function sqlPassword() {
  const b64 = (env.PAYDISK_SQL_PASSWORD_B64 || "").trim();
  if (b64) {
    try {
      return Buffer.from(b64, "base64").toString("utf8");
    } catch {
      /* fall through */
    }
  }
  return (env.PAYDISK_SQL_PASSWORD || "").trim();
}

// 155: PAYDISK_SQL_PROD_ENCRYPT=false (encrypt:true → socket hang up)
const encrypt =
  env.PAYDISK_SQL_PROD_ENCRYPT === "true"
    ? true
    : env.PAYDISK_SQL_PROD_ENCRYPT === "false"
      ? false
      : env.PAYDISK_SQL_ENCRYPT !== "false";

const pool = await sql.connect({
  server: host,
  port: Number(env.PAYDISK_SQL_PORT || 1433),
  database,
  user: env.PAYDISK_SQL_USER,
  password: sqlPassword(),
  options: {
    encrypt,
    trustServerCertificate: env.PAYDISK_SQL_TRUST_CERT !== "false",
  },
  connectionTimeout: 20000,
  requestTimeout: 180000,
});

function filled(v) {
  const s = v == null ? "" : String(v).trim();
  return s !== "" && s !== "0" ? s : null;
}

const ping = await pool
  .request()
  .query("SELECT @@SERVERNAME AS ServerName, DB_NAME() AS DbName");
console.log("CONNECTED", ping.recordset[0]);
console.log(`VERIFY yarane txn ${trId} on ${host}/${database}`);

const hdr = await pool
  .request()
  .input("id", sql.Int, trId)
  .query(`
  SELECT t.Id, t.Title, t.Date, t.Registrar, t.Key1, t.Key2, t.Key3,
         t.RegistrationDateTime
  FROM dbo.MakeOverTransactions t WITH (NOLOCK)
  WHERE t.Id = @id
`);

if (!hdr.recordset[0]) {
  console.error("TXN NOT FOUND");
  await pool.close();
  process.exit(2);
}

const h = hdr.recordset[0];
console.log("\n=== HEADER (MakeOverTransactions) ===");
console.log({
  Id: h.Id,
  Title: h.Title,
  Date: h.Date,
  Registrar: h.Registrar,
  Key1: h.Key1,
  Key2: filled(h.Key2) ? "[set]" : null,
  Key3: filled(h.Key3) ? "[set]" : null,
  Key2Len: filled(h.Key2)?.length || 0,
  Key3Len: filled(h.Key3)?.length || 0,
});

const ops = await pool
  .request()
  .input("id", sql.Int, trId)
  .query(`
  SELECT COUNT(*) AS payedRows
  FROM dbo.PayedMakeOvers WITH (NOLOCK)
  WHERE TransactionId = @id
`);

const stats = await pool
  .request()
  .input("id", sql.Int, trId)
  .query(`
  SELECT
    COUNT_BIG(*) AS payedRows,
    COUNT(DISTINCT MakeOverSupplyLocationId) AS supplyCount
  FROM dbo.PayedMakeOvers WITH (NOLOCK)
  WHERE TransactionId = @id
`);

const detail = await pool
  .request()
  .input("id", sql.Int, trId)
  .query(`
  SELECT
    COUNT(*) AS payedRows,
    COUNT(DISTINCT MakeOverSupplyLocationId) AS supplyCount,
    SUM(ISNULL(LocalSubsidy,0) + ISNULL(UniverseSubsidy,0)) AS subsidySum,
    MIN(FromDate) AS minFromDate,
    MAX(FromDate) AS maxFromDate
  FROM dbo.PayedMakeOvers WITH (NOLOCK)
  WHERE TransactionId = @id
`);

const supplies = await pool
  .request()
  .input("id", sql.Int, trId)
  .query(`
  SELECT TOP 20
    p.MakeOverSupplyLocationId AS Id,
    ISNULL(s.MakeOverSupplyLocationTitle, N'(نامشخص)') AS Title,
    ISNULL(s.MakeOverSuplyLocationKeyword, N'') AS Keyword,
    COUNT(*) AS cnt
  FROM dbo.PayedMakeOvers p WITH (NOLOCK)
  LEFT JOIN dbo.MakeOverSupplyLocation s WITH (NOLOCK)
    ON s.MakeOverSupplyLocationId = p.MakeOverSupplyLocationId
  WHERE p.TransactionId = @id
  GROUP BY p.MakeOverSupplyLocationId, s.MakeOverSupplyLocationTitle, s.MakeOverSuplyLocationKeyword
  ORDER BY COUNT(*) DESC
`);

const opsRows = Number(ops.recordset[0].payedRows);
const statsRows = Number(stats.recordset[0].payedRows);
const detailRows = Number(detail.recordset[0].payedRows);
const statsSupply = Number(stats.recordset[0].supplyCount);
const detailSupply = Number(detail.recordset[0].supplyCount);
const supplySum = supplies.recordset.reduce((a, r) => a + Number(r.cnt), 0);

console.log("\n=== PAYED ROW COUNTS ===");
console.log({
  opsDoc_COUNT: opsRows,
  panelStats_COUNT_BIG: statsRows,
  panelDetail_COUNT: detailRows,
  match_ops_vs_stats: opsRows === statsRows,
  match_ops_vs_detail: opsRows === detailRows,
  match_stats_vs_detail: statsRows === detailRows,
});

console.log("\n=== SUPPLY / MONEY ===");
console.log({
  stats_supplyCount: statsSupply,
  detail_supplyCount: detailSupply,
  match_supply: statsSupply === detailSupply,
  subsidySum: Number(detail.recordset[0].subsidySum || 0),
  minFromDate: detail.recordset[0].minFromDate,
  maxFromDate: detail.recordset[0].maxFromDate,
  supplyGroupsReturned: supplies.recordset.length,
  supplyGroupsCntSum: supplySum,
});

console.log("\n=== SUPPLY BREAKDOWN (TOP) ===");
console.table(
  supplies.recordset.map((r) => ({
    Id: r.Id,
    Title: String(r.Title).slice(0, 40),
    Keyword: r.Keyword,
    cnt: Number(r.cnt),
  })),
);

console.log("\n=== LAZY KEYS (/stats?fields=keys) ===");
console.log({
  hasPeopleList: !!filled(h.Key2),
  hasBank: !!filled(h.Key3),
  key2: filled(h.Key2) ? "✓ present" : "— empty",
  key3: filled(h.Key3) ? "✓ present" : "— empty",
});

const ok =
  opsRows === statsRows &&
  opsRows === detailRows &&
  statsSupply === detailSupply;

console.log("\n=== VERDICT ===");
console.log(
  ok
    ? `PASS: panel stats/detail match ops-doc COUNT(*) for txn ${trId}`
    : `FAIL: mismatch between panel queries and ops-doc count for txn ${trId}`,
);

await pool.close();
process.exit(ok ? 0 : 1);
