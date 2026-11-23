import { createRequire } from "module";
import { loadEnvLocal } from "./_load-env-local.mjs";
const require = createRequire(process.cwd() + "/package.json");
const env = loadEnvLocal(import.meta.url);
const sql = require("mssql/msnodesqlv8");
const cs = `Driver={ODBC Driver 18 for SQL Server};Server=${env.PAYDISK_TEST_SQL_HOST || "10.0.28.10"};Database=${env.PAYDISK_TEST_SQL_DATABASE || "DB_Mostamary"};Trusted_Connection=Yes;Encrypt=yes;TrustServerCertificate=yes;`;
const pool = await new sql.ConnectionPool({ connectionString: cs, requestTimeout: 30000 }).connect();
const r = await pool.request().query(`
  SELECT name FROM sys.procedures
  WHERE name LIKE N'%Hagh%' OR name LIKE N'%Parastari%' OR name LIKE N'%Emdad%' OR name LIKE N'%Hadaf%' OR name LIKE N'%Marakez%' OR name LIKE N'%Calculate%'
  ORDER BY name
`);
console.log(r.recordset);
await pool.close();
