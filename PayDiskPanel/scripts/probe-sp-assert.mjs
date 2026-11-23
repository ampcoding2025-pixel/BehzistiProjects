import { createRequire } from "module";
import { pathToFileURL } from "url";
import path from "path";

// Run assert via direct import of compiled path won't work for TS.
// Use SQL equivalent quickly for 10815 vs 10801.
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

const dry = await pool.request().query(`
  SELECT COUNT_BIG(*) cnt, SUM(CONVERT(bigint,Money)) moneySum
  FROM dbo.ContinusPayment WITH (NOLOCK)
  WHERE ContinusPaymentSupplyLocationId IN (${SUPPLY})
`);
const peer = await pool.request().query(`
  SELECT COUNT_BIG(*) cnt, SUM(CONVERT(bigint,Money)) moneySum
  FROM dbo.PayedContinusPayment WITH (NOLOCK)
  WHERE TransactionId = 10801
`);
const peer796 = await pool.request().query(`
  SELECT TOP 1 Id, Title, Ky FROM dbo.PayedTransaction WITH (NOLOCK) WHERE Id = 10796
`);
console.log({
  dryRunNewSp: dry.recordset[0],
  saved10801: peer.recordset[0],
  match10801:
    String(dry.recordset[0].cnt) === String(peer.recordset[0].cnt) &&
    String(dry.recordset[0].moneySum) === String(peer.recordset[0].moneySum),
  txn10796: peer796.recordset[0],
});
await pool.close();
