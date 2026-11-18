import sql from "mssql";
import { loadEnvLocal } from "./_load-env-local.mjs";

const env = loadEnvLocal(import.meta.url);

const pool = await sql.connect({
  server: env.PAYDISK_SQL_HOST,
  port: Number(env.PAYDISK_SQL_PORT || 1433),
  database: env.PAYDISK_SQL_DATABASE,
  user: env.PAYDISK_SQL_USER,
  password: env.PAYDISK_SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: true },
});

const procs = await pool.request().query(`
  SELECT SCHEMA_NAME(schema_id) AS sch, name
  FROM sys.procedures
  WHERE name LIKE N'%Calculate%' OR name LIKE N'%Marakez%' OR name LIKE N'%Hagh%' OR name LIKE N'%Emdad%' OR name LIKE N'%Hadaf%'
  ORDER BY name
`);
console.log("Relevant procedures:");
console.table(procs.recordset);

const latest = await pool.request().query(`
  SELECT TOP 5 Id, Title, Key2, Key3, Date
  FROM dbo.MakeOverTransactions
  ORDER BY Id DESC
`);
console.log("Latest MakeOverTransactions:");
console.table(latest.recordset);

await pool.close();
