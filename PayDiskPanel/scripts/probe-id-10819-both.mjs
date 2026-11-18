import sql from "mssql";
import { loadEnvLocal } from "./_load-env-local.mjs";

const env = loadEnvLocal(import.meta.url);
function sqlPassword() {
  const b64 = (env.PAYDISK_SQL_PASSWORD_B64 || "").trim();
  if (b64) {
    try {
      return Buffer.from(b64, "base64").toString("utf8");
    } catch {
      /* */
    }
  }
  return (env.PAYDISK_SQL_PASSWORD || "").trim();
}

const pool = await sql.connect({
  server: env.PAYDISK_SQL_HOST || "10.1.0.155",
  port: 1433,
  database: env.PAYDISK_SQL_PROD_DATABASE || "DB_Mostamary",
  user: env.PAYDISK_SQL_USER,
  password: sqlPassword(),
  options: { encrypt: false, trustServerCertificate: true },
  requestTimeout: 60000,
});

const a = await pool.request().query(`
  SELECT Id, Title, Date FROM dbo.MakeOverTransactions WITH (NOLOCK) WHERE Id=10819
`);
const b = await pool.request().query(`
  SELECT Id, Title, RegistrationDate, RelatedTo, Year, Ky
  FROM dbo.PayedTransaction WITH (NOLOCK) WHERE Id=10819
`);
console.log("YARANE MakeOver 10819", a.recordset[0] || null);
console.log("MOSTAMARI Payed 10819", b.recordset[0] || null);
await pool.close();
