import sql from "mssql";
import { loadEnvLocal } from "./_load-env-local.mjs";

const env = loadEnvLocal(import.meta.url);

const pool = await sql.connect({
  server: "10.1.0.157",
  port: 1433,
  database: "master",
  user: "alipoor",
  password: env.PAYDISK_SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: true },
});

const all = await pool.request().query("SELECT name FROM sys.databases WHERE state_desc='ONLINE' ORDER BY name");
const accessible = [];
for (const { name } of all.recordset) {
  const r = await pool.request().query(`SELECT HAS_DBACCESS(N'${name.replace(/'/g, "''")}') AS a`);
  if (r.recordset[0].a === 1) accessible.push(name);
}
console.log("Accessible DBs for alipoor:", accessible);

for (const db of accessible) {
  if (["master", "tempdb", "model", "msdb"].includes(db)) continue;
  try {
    const q = await pool.request().query(`
      SELECT TOP 20 TABLE_NAME
      FROM [${db}].INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME IN (
        'PayedTransaction','MakeOverTransactions','PayedMakeOvers',
        'PayedContinusPayment','IBN_AccountNumber','ContinusPayment'
      )
      ORDER BY TABLE_NAME
    `);
    if (q.recordset.length) {
      console.log(`\n=== ${db} has payment tables ===`);
      console.table(q.recordset);
    }
  } catch (e) {
    console.log(`${db}:`, e.message);
  }
}

await pool.close();
