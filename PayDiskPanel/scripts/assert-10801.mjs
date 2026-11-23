import { createRequire } from "module";
import { loadEnvLocal } from "./_load-env-local.mjs";

const require = createRequire(process.cwd() + "/package.json");
const env = loadEnvLocal(import.meta.url);
const sql = require("mssql/msnodesqlv8");
const cs = `Driver={ODBC Driver 18 for SQL Server};Server=${env.PAYDISK_TEST_SQL_HOST || "10.0.28.10"};Database=${env.PAYDISK_TEST_SQL_DATABASE || "DB_Mostamary"};Trusted_Connection=Yes;Encrypt=yes;TrustServerCertificate=yes;`;
const SUPPLY =
  "1,2,3,4,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,38";

const pool = await new sql.ConnectionPool({
  connectionString: cs,
  requestTimeout: 180_000,
}).connect();

const hdr = await pool.request().query(`
  SELECT Id, Title, Ky, Year,
    LEFT(CONVERT(nvarchar(200), Description), 120) AS Description
  FROM dbo.PayedTransaction WITH (NOLOCK)
  WHERE Id = 10801
`);
const dry = await pool.request().query(`
  SELECT COUNT_BIG(*) cnt, SUM(CONVERT(bigint, Money)) moneySum
  FROM dbo.ContinusPayment WITH (NOLOCK)
  WHERE ContinusPaymentSupplyLocationId IN (${SUPPLY})
`);
const dryH = await pool.request().query(`
  SELECT COUNT_BIG(*) cnt, Money
  FROM dbo.ContinusPayment WITH (NOLOCK)
  WHERE ContinusPaymentSupplyLocationId IN (${SUPPLY})
  GROUP BY Money
  ORDER BY Money DESC
`);
const saved = await pool.request().query(`
  SELECT COUNT_BIG(*) cnt, SUM(CONVERT(bigint, Money)) moneySum
  FROM dbo.PayedContinusPayment WITH (NOLOCK)
  WHERE TransactionId = 10801
`);
const savedH = await pool.request().query(`
  SELECT COUNT_BIG(*) cnt, Money
  FROM dbo.PayedContinusPayment WITH (NOLOCK)
  WHERE TransactionId = 10801
  GROUP BY Money
  ORDER BY Money DESC
`);
const cur = await pool.request().query(`
  SELECT COUNT_BIG(*) cnt, SUM(CONVERT(bigint, Money)) moneySum
  FROM dbo.PayedContinusPayment WITH (NOLOCK)
  WHERE TransactionId = 10815
`);

const d = dry.recordset[0];
const s = saved.recordset[0];
const c = cur.recordset[0];
const histKey = (rows) =>
  rows.map((r) => `${Number(r.Money)}:${Number(r.cnt)}`).join("|");
const dh = histKey(dryH.recordset);
const sh = histKey(savedH.recordset);

const out = {
  peer: hdr.recordset[0],
  newSpDryRun: { cnt: String(d.cnt), moneySum: String(d.moneySum) },
  saved10801: { cnt: String(s.cnt), moneySum: String(s.moneySum) },
  current10815: { cnt: String(c.cnt), moneySum: String(c.moneySum) },
  cntMatch: String(d.cnt) === String(s.cnt),
  moneyMatch: String(d.moneySum) === String(s.moneySum),
  histMatch: dh === sh,
  deltaCnt: Number(d.cnt) - Number(s.cnt),
  deltaMoney: Number(d.moneySum) - Number(s.moneySum),
  dryHist: dryH.recordset,
  savedHist: savedH.recordset,
  verdict:
    String(d.cnt) === String(s.cnt) && String(d.moneySum) === String(s.moneySum)
      ? "PASS — new SP dry-run matches saved #10801"
      : "DRIFT — ContinusPayment changed since #10801 was calculated (expected for older periods)",
};
console.log(JSON.stringify(out, null, 2));
await pool.close();
