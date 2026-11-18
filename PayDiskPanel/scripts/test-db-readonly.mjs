import sql from "mssql";
import { loadEnvLocal } from "./_load-env-local.mjs";

const env = loadEnvLocal(import.meta.url);

const config = {
  server: env.PAYDISK_SQL_HOST,
  port: Number(env.PAYDISK_SQL_PORT || 1433),
  database: env.PAYDISK_SQL_DATABASE,
  user: env.PAYDISK_SQL_USER,
  password: env.PAYDISK_SQL_PASSWORD,
  options: {
    encrypt: env.PAYDISK_SQL_ENCRYPT !== "false",
    trustServerCertificate: env.PAYDISK_SQL_TRUST_CERT !== "false",
  },
  connectionTimeout: 15000,
  requestTimeout: 15000,
};

console.log(
  `Connecting (read-only probe) → ${config.server}/${config.database} as ${config.user}…`,
);

try {
  const pool = await sql.connect(config);
  const ping = await pool.request().query("SELECT @@SERVERNAME AS ServerName, DB_NAME() AS DbName, SUSER_SNAME() AS LoginName");
  console.log("OK ping:", ping.recordset[0]);

  const tables = await pool.request().query(`
    SELECT TOP 15 TABLE_SCHEMA, TABLE_NAME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE = 'BASE TABLE'
      AND TABLE_NAME IN (
        'PayedTransaction','PayedContinusPayment','MakeOverTransactions',
        'PayedMakeOvers','MakeOverSupplyLocation','IBN_AccountNumber','Person',
        'ContinusPayment'
      )
    ORDER BY TABLE_NAME
  `);
  console.log("Key tables visible:");
  console.table(tables.recordset);

  const procs = await pool.request().query(`
    SELECT TOP 20 ROUTINE_NAME
    FROM INFORMATION_SCHEMA.ROUTINES
    WHERE ROUTINE_TYPE = 'PROCEDURE'
      AND ROUTINE_NAME LIKE 'Calculate%'
    ORDER BY ROUTINE_NAME
  `);
  console.log("Calculate* procedures visible:");
  console.table(procs.recordset);

  await pool.close();
  console.log("Done (no writes).");
} catch (err) {
  console.error("FAILED:", err.message);
  process.exitCode = 1;
}
