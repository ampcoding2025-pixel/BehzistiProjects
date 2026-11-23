import { createRequire } from "module";
import { loadEnvLocal } from "./_load-env-local.mjs";

const require = createRequire(process.cwd() + "/package.json");
const env = loadEnvLocal(import.meta.url);
const sql = require("mssql/msnodesqlv8");
const cs = `Driver={ODBC Driver 18 for SQL Server};Server=${env.PAYDISK_TEST_SQL_HOST || "10.0.28.10"};Database=${env.PAYDISK_TEST_SQL_DATABASE || "DB_Mostamary"};Trusted_Connection=Yes;Encrypt=yes;TrustServerCertificate=yes;`;

const pool = await new sql.ConnectionPool({
  connectionString: cs,
  connectionTimeout: 20_000,
  requestTimeout: 60_000,
}).connect();

const idx = await pool.request().query(`
  SELECT i.name, i.is_disabled, i.type_desc,
    STATS_DATE(i.object_id, i.index_id) AS statsDate
  FROM sys.indexes i
  WHERE i.object_id = OBJECT_ID(N'dbo.PayedContinusPayment')
    AND i.name IN (N'IX_PayedContinusPayment_TransactionId', N'IX_ContinusPayment_CalcSupply_Covering')
  UNION ALL
  SELECT i.name, i.is_disabled, i.type_desc,
    STATS_DATE(i.object_id, i.index_id) AS statsDate
  FROM sys.indexes i
  WHERE i.object_id = OBJECT_ID(N'dbo.ContinusPayment')
    AND i.name = N'IX_ContinusPayment_CalcSupply_Covering'
`);
console.log(idx.recordset);

const def = await pool.request().query(`
  SELECT
    CASE WHEN OBJECT_DEFINITION(OBJECT_ID(N'dbo.CalculateTransaction')) LIKE N'%mega-transaction%'
      THEN 'v2-no-mega-tran' ELSE 'other' END AS flavor,
    CASE WHEN OBJECT_DEFINITION(OBJECT_ID(N'dbo.CalculateTransaction')) LIKE N'%BEGIN TRAN%'
      THEN 1 ELSE 0 END AS hasBeginTran,
    OBJECT_ID(N'dbo.CalculateTransaction_OLD') AS oldId
`);
console.log(def.recordset[0]);

await pool.close();
