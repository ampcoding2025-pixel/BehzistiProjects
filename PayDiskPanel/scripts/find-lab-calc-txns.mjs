import { createRequire } from "module";
import { loadEnvLocal } from "./_load-env-local.mjs";

const require = createRequire(process.cwd() + "/package.json");
const env = loadEnvLocal(import.meta.url);
const sql = require("mssql/msnodesqlv8");
const cs = `Driver={ODBC Driver 18 for SQL Server};Server=${env.PAYDISK_TEST_SQL_HOST || "10.0.28.10"};Database=${env.PAYDISK_TEST_SQL_DATABASE || "DB_Mostamary"};Trusted_Connection=Yes;Encrypt=yes;TrustServerCertificate=yes;`;

const pool = await new sql.ConnectionPool({
  connectionString: cs,
  connectionTimeout: 20_000,
  requestTimeout: 180_000,
}).connect();

const latest = await pool.request().query(`
  SELECT TOP 15 t.Id, t.Title, t.Ky,
    LEFT(CONVERT(nvarchar(200), t.Description), 80) AS Description
  FROM dbo.PayedTransaction t WITH (NOLOCK)
  ORDER BY t.Id DESC
`);
console.log("latest txns", JSON.stringify(latest.recordset, null, 2));

const withRows = await pool.request().query(`
  SELECT TOP 10
    p.TransactionId,
    COUNT_BIG(*) AS cnt,
    MAX(t.Title) AS Title,
    MAX(t.Ky) AS Ky
  FROM dbo.PayedContinusPayment p WITH (NOLOCK)
  LEFT JOIN dbo.PayedTransaction t WITH (NOLOCK) ON t.Id = p.TransactionId
  GROUP BY p.TransactionId
  ORDER BY COUNT_BIG(*) DESC
`);
console.log("top by pay rows", JSON.stringify(withRows.recordset, null, 2));

await pool.close();
