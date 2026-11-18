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

const procs = await pool.request().query(`
SELECT p.name AS procName, par.name AS paramName, t.name AS typeName, par.is_output
FROM sys.procedures p
JOIN sys.parameters par ON par.object_id = p.object_id
JOIN sys.types t ON t.user_type_id = par.user_type_id
WHERE p.name LIKE 'Calculate%'
ORDER BY p.name, par.parameter_id
`);
console.log(JSON.stringify(procs.recordset, null, 2));

const cols = await pool.request().query(`
SELECT COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'MakeOverTransactions'
  AND COLUMN_NAME IN ('Key1','Key2','Key3','Id','Title')
`);
console.log("cols", cols.recordset);

await pool.close();
