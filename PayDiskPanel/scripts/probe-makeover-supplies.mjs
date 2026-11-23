import { createRequire } from "module";
import { loadEnvLocal } from "./_load-env-local.mjs";
const require = createRequire(process.cwd() + "/package.json");
const env = loadEnvLocal(import.meta.url);
const sql = require("mssql/msnodesqlv8");
const cs = `Driver={ODBC Driver 18 for SQL Server};Server=${env.PAYDISK_TEST_SQL_HOST || "10.0.28.10"};Database=${env.PAYDISK_TEST_SQL_DATABASE || "DB_Mostamary"};Trusted_Connection=Yes;Encrypt=yes;TrustServerCertificate=yes;`;
const pool = await new sql.ConnectionPool({
  connectionString: cs,
  requestTimeout: 120000,
}).connect();
const r = await pool.request().query(`
  SELECT TOP 10 MO.MakeOverSupplyLocationId AS sid, COUNT_BIG(*) AS cnt
  FROM dbo.MakeOver MO WITH (NOLOCK)
  INNER JOIN dbo.Person P WITH (NOLOCK) ON P.ID = MO.PersonId AND P.IsDead = 0
  GROUP BY MO.MakeOverSupplyLocationId
  ORDER BY COUNT_BIG(*) DESC
`);
console.log(r.recordset);
await pool.close();
