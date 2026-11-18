import { createRequire } from "module";
import { join } from "path";

const require = createRequire(join(process.cwd(), "package.json"));
const sql = require("mssql/msnodesqlv8");
const cs =
  "Driver={ODBC Driver 18 for SQL Server};Server=10.0.28.10;Database=DB_Mostamary;Trusted_Connection=Yes;Encrypt=yes;TrustServerCertificate=yes;";

const pool = await new sql.ConnectionPool({
  connectionString: cs,
  connectionTimeout: 15000,
  requestTimeout: 60000,
}).connect();

const cols = await pool.request().query(`
SELECT COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='MakeOverTransactions'
ORDER BY ORDINAL_POSITION
`);
console.log("COLUMNS", cols.recordset.map((c) => c.COLUMN_NAME).join(", "));

const row = await pool.request().query(`
SELECT TOP 1 * FROM dbo.MakeOverTransactions WHERE Id = 685
`);
console.log("ROW685", JSON.stringify(row.recordset[0], null, 2));

await pool.close();
