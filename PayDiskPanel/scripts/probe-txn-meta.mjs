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

const filled = await pool.request().query(`
SELECT TOP 10 Id, Title, Registrar, RegistrationDateTime, Acceptor, Description, Key1, Key2, Key3
FROM dbo.MakeOverTransactions
WHERE Registrar IS NOT NULL OR RegistrationDateTime IS NOT NULL OR Acceptor IS NOT NULL OR Description IS NOT NULL OR Key1 IS NOT NULL
ORDER BY Id DESC
`);
console.log("FILLED_SAMPLES", JSON.stringify(filled.recordset, null, 2));

const stats = await pool.request().query(`
SELECT
  COUNT(*) AS total,
  SUM(CASE WHEN Registrar IS NOT NULL AND LTRIM(RTRIM(Registrar))<>'' THEN 1 ELSE 0 END) AS hasRegistrar,
  SUM(CASE WHEN RegistrationDateTime IS NOT NULL THEN 1 ELSE 0 END) AS hasRegDt,
  SUM(CASE WHEN Acceptor IS NOT NULL AND LTRIM(RTRIM(Acceptor))<>'' THEN 1 ELSE 0 END) AS hasAcceptor,
  SUM(CASE WHEN Description IS NOT NULL AND LTRIM(RTRIM(Description))<>'' THEN 1 ELSE 0 END) AS hasDesc,
  SUM(CASE WHEN Key1 IS NOT NULL AND LTRIM(RTRIM(Key1))<>'' THEN 1 ELSE 0 END) AS hasKey1
FROM dbo.MakeOverTransactions
`);
console.log("STATS", stats.recordset[0]);

const defs = await pool.request().query(`
SELECT TOP 5 * FROM dbo.MakeOverDefinitions
`);
console.log("DEFS_COLS", defs.recordset[0] ? Object.keys(defs.recordset[0]) : "none");
console.log("DEF1", JSON.stringify(defs.recordset.find((d) => d.Id === 1 || d.DefinitionId === 1) || defs.recordset[0], null, 2));

await pool.close();
