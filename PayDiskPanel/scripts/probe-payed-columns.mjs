/** Read column defs for PayedContinusPayment / PayedMakeOvers on lab. */
import { createRequire } from "module";
import { loadEnvLocal } from "./_load-env-local.mjs";
const require = createRequire(process.cwd() + "/package.json");
const env = loadEnvLocal(import.meta.url);
const sql = require("mssql/msnodesqlv8");
const cs = `Driver={ODBC Driver 18 for SQL Server};Server=${env.PAYDISK_TEST_SQL_HOST || "10.0.28.10"};Database=${env.PAYDISK_TEST_SQL_DATABASE || "DB_Mostamary"};Trusted_Connection=Yes;Encrypt=yes;TrustServerCertificate=yes;`;
const pool = await new sql.ConnectionPool({ connectionString: cs, requestTimeout: 60000 }).connect();
for (const t of ["PayedContinusPayment", "PayedMakeOvers"]) {
  const r = await pool.request().query(`
    SELECT c.column_id, c.name, ty.name AS typ, c.max_length, c.precision, c.scale, c.is_nullable, c.is_identity
    FROM sys.columns c
    INNER JOIN sys.types ty ON ty.user_type_id = c.user_type_id
    WHERE c.object_id = OBJECT_ID(N'dbo.${t}')
    ORDER BY c.column_id
  `);
  console.log("===", t, "===");
  console.log(JSON.stringify(r.recordset, null, 2));
}
await pool.close();
