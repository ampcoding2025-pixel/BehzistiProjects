import { readFileSync } from "fs";
import sql from "mssql";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  const i = line.indexOf("=");
  const k = line.slice(0, i).trim();
  const v = line.slice(i + 1).trim();
  if (k.startsWith("PAYDISK_")) process.env[k] = v;
}
function b64(v) {
  try {
    return Buffer.from(v, "base64").toString("utf8");
  } catch {
    return "";
  }
}
const id = Number(process.argv[2] || 856);
const pool = await sql.connect({
  server: process.env.PAYDISK_SQL_HOST,
  port: Number(process.env.PAYDISK_SQL_PORT || 1433),
  database:
    process.env.PAYDISK_SQL_PROD_DATABASE || process.env.PAYDISK_SQL_DATABASE,
  user: process.env.PAYDISK_SQL_USER,
  password: process.env.PAYDISK_SQL_PASSWORD_B64
    ? b64(process.env.PAYDISK_SQL_PASSWORD_B64)
    : process.env.PAYDISK_SQL_PASSWORD,
  options: { encrypt: false, trustServerCertificate: true },
});
const mo = await pool
  .request()
  .input("id", sql.Int, id)
  .query(
    `SELECT TOP 1 Id, Title, Key1, Key2 FROM dbo.MakeOverTransactions WITH (NOLOCK) WHERE Id=@id`,
  );
const pt = await pool
  .request()
  .input("id", sql.Int, id)
  .query(
    `SELECT TOP 1 Id, Title, Ky, Year, (SELECT COUNT_BIG(*) FROM dbo.PayedContinusPayment p WITH (NOLOCK) WHERE p.TransactionId=@id) AS payedRows FROM dbo.PayedTransaction WITH (NOLOCK) WHERE Id=@id`,
  );
console.log("MakeOver(yarane)", mo.recordset[0] || null);
console.log("PayedTransaction(mostamari)", pt.recordset[0] || null);
await pool.close();
