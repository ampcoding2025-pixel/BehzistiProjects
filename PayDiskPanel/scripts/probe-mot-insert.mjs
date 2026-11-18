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
SELECT c.name, t.name AS typ, c.is_nullable, c.is_identity,
       OBJECT_DEFINITION(c.default_object_id) AS defVal
FROM sys.columns c
JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID('dbo.MakeOverTransactions')
ORDER BY c.column_id
`);
console.log(JSON.stringify(cols.recordset, null, 2));

const sample = await pool.request().query(`
SELECT TOP 3 Id, Title, Date, Registrar, RegistrationDateTime, DefinitionId
FROM dbo.MakeOverTransactions ORDER BY Id DESC
`);
console.log("sample", sample.recordset);

await pool.close();
