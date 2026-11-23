/**
 * Read-only: check calc SPs on prod 155 (alipoor2 may lack VIEW DEFINITION).
 */
import { createRequire } from "module";
import { loadEnvLocal } from "./_load-env-local.mjs";

const require = createRequire(process.cwd() + "/package.json");
const env = loadEnvLocal(import.meta.url);
const sql = require("mssql");

const host = env.PAYDISK_SQL_HOST || "10.1.0.155";
const database = env.PAYDISK_SQL_PROD_DATABASE || "DB_Mostamary";
const user = env.PAYDISK_SQL_USER || "alipoor2";
const password = env.PAYDISK_SQL_PASSWORD_B64
  ? Buffer.from(env.PAYDISK_SQL_PASSWORD_B64, "base64").toString("utf8")
  : env.PAYDISK_SQL_PASSWORD || "";

const pool = await sql.connect({
  server: host,
  database,
  user,
  password,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  connectionTimeout: 20000,
  requestTimeout: 60000,
});

console.log({ host, database, user });

const meta = await pool.request().query(`
  SELECT DB_NAME() AS db, @@SERVERNAME AS srv,
         SUSER_SNAME() AS login, USER_NAME() AS dbUser
`);
console.log("session", meta.recordset[0]);

const procs = await pool.request().query(`
  SELECT TOP 40 s.name AS sch, p.name
  FROM sys.procedures p
  INNER JOIN sys.schemas s ON s.schema_id = p.schema_id
  WHERE p.name LIKE N'%Calculate%' OR p.name LIKE N'%Marakez%'
  ORDER BY p.name
`);
console.log("visible procs", procs.recordset.length, procs.recordset);

// Try write login if configured — may see definitions
const wUser = (env.PAYDISK_SQL_WRITE_USER || "").trim();
const wPass = env.PAYDISK_SQL_WRITE_PASSWORD_B64
  ? Buffer.from(env.PAYDISK_SQL_WRITE_PASSWORD_B64, "base64").toString("utf8")
  : env.PAYDISK_SQL_WRITE_PASSWORD || "";

if (wUser && wPass) {
  await pool.close();
  const wpool = await sql.connect({
    server: host,
    database,
    user: wUser,
    password: wPass,
    options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true },
    connectionTimeout: 20000,
    requestTimeout: 60000,
  });
  console.log("write login", wUser);
  const wmeta = await wpool.request().query(`
    SELECT SUSER_SNAME() AS login, USER_NAME() AS dbUser
  `);
  console.log("write session", wmeta.recordset[0]);
  const names = [
    "CalculateTransaction",
    "CalculateHadafmandi",
    "CalculateEmdad",
    "CalculateHaghParastari",
    "CalculateHaghParastariFamily",
    "CalculateMarakezYarane",
  ];
  for (const name of names) {
    const r = await wpool.request().query(`
      SELECT
        OBJECT_ID(N'dbo.${name}', N'P') AS id,
        LEN(OBJECT_DEFINITION(OBJECT_ID(N'dbo.${name}', N'P'))) AS len,
        CASE WHEN OBJECT_DEFINITION(OBJECT_ID(N'dbo.${name}', N'P')) LIKE N'%BEGIN TRY%' THEN 1 ELSE 0 END AS looksOptimized,
        CASE WHEN OBJECT_DEFINITION(OBJECT_ID(N'dbo.${name}', N'P')) LIKE N'%baccountvalidated%' THEN 1 ELSE 0 END AS hasBaccount
    `);
    console.log(name, r.recordset[0]);
  }
  const idx = await wpool.request().query(`
    SELECT i.name
    FROM sys.indexes i
    WHERE i.object_id = OBJECT_ID(N'dbo.ContinusPayment')
      AND i.name IN (N'IX_ContinusPayment_CalcSupply_Covering', N'IX_PayedContinusPayment_TransactionId')
    UNION ALL
    SELECT i.name
    FROM sys.indexes i
    WHERE i.object_id = OBJECT_ID(N'dbo.MakeOver')
      AND i.name = N'IX_MakeOver_CalcSupply_Covering'
  `);
  console.log("opt indexes", idx.recordset);
  await wpool.close();
} else {
  await pool.close();
}
