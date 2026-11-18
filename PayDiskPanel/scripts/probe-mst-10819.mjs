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

const host = env.PAYDISK_SQL_HOST || "10.1.0.155";
const database = env.PAYDISK_SQL_PROD_DATABASE || "DB_Mostamary";
const trId = Number(process.argv[2] || 10819);

const pool = await sql.connect({
  server: host,
  port: Number(env.PAYDISK_SQL_PORT || 1433),
  database,
  user: env.PAYDISK_SQL_USER,
  password: sqlPassword(),
  options: {
    encrypt: env.PAYDISK_SQL_PROD_ENCRYPT === "true",
    trustServerCertificate: env.PAYDISK_SQL_TRUST_CERT !== "false",
  },
  requestTimeout: 60000,
});

const rs = await pool.request().input("id", sql.Int, trId).query(`
  SELECT Id, Title, RegistrationDate, RelatedTo, Ky, Year,
         AcceptanceDateTime, AcceptorUserId, Description,
         ListToken, FileName, ExportToken
  FROM dbo.PayedTransaction WITH (NOLOCK)
  WHERE Id = @id
`);
console.log(JSON.stringify(rs.recordset[0], null, 2));

const kys = await pool.request().query(`
  SELECT TOP 40 Ky, COUNT(*) AS cnt
  FROM dbo.PayedTransaction WITH (NOLOCK)
  WHERE Title LIKE N'%اتیسم%' OR Title LIKE N'%اتيس%' OR Title LIKE N'%پرستاری%' OR Title LIKE N'%پرستاري%'
  GROUP BY Ky
  ORDER BY cnt DESC
`);
console.log("\nKy for nursing/autism titles:");
console.table(kys.recordset);

const distinctKy = await pool.request().query(`
  SELECT TOP 50 ISNULL(Ky, N'(null)') AS Ky, COUNT(*) AS cnt
  FROM dbo.PayedTransaction WITH (NOLOCK)
  GROUP BY Ky
  ORDER BY COUNT(*) DESC
`);
console.log("\nTop Ky values:");
console.table(distinctKy.recordset);

await pool.close();
