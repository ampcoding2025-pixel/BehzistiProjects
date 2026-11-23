import { createRequire } from "module";
import { loadEnvLocal } from "./_load-env-local.mjs";

const require = createRequire(process.cwd() + "/package.json");
const env = loadEnvLocal(import.meta.url);
const sql = require("mssql/msnodesqlv8");
const cs = `Driver={ODBC Driver 18 for SQL Server};Server=${env.PAYDISK_TEST_SQL_HOST || "10.0.28.10"};Database=${env.PAYDISK_TEST_SQL_DATABASE || "DB_Mostamary"};Trusted_Connection=Yes;Encrypt=yes;TrustServerCertificate=yes;`;

const pool = await new sql.ConnectionPool({
  connectionString: cs,
  connectionTimeout: 20_000,
  requestTimeout: 30_000,
}).connect();

const r = await pool.request().query(`
  SELECT
    DB_NAME() AS db,
    OBJECT_ID(N'dbo.CalculateTransaction', N'P') AS calcId,
    OBJECT_ID(N'dbo.CalculateTransaction_OLD', N'P') AS oldId,
    OBJECT_SCHEMA_NAME(OBJECT_ID(N'dbo.CalculateTransaction')) AS sch
`);
console.log(r.recordset[0]);

try {
  const e = await pool.request().query(`EXEC dbo.CalculateTransaction @TrId = -1`);
  console.log("exec odd", e);
} catch (err) {
  console.log("exec probe error (expected if validation):", err.message?.slice(0, 200));
}

await pool.close();
