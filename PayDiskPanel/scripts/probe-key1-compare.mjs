import sql from "mssql";
import { loadEnvLocal } from "./_load-env-local.mjs";

const env = loadEnvLocal(import.meta.url);
const password = Buffer.from(env.PAYDISK_SQL_PASSWORD_B64 || "", "base64").toString(
  "utf8",
);
const pool = await sql.connect({
  server: env.PAYDISK_SQL_HOST || "10.1.0.155",
  port: 1433,
  database: env.PAYDISK_SQL_PROD_DATABASE || "DB_Mostamary",
  user: env.PAYDISK_SQL_USER || "alipoor2",
  password,
  options: {
    encrypt: env.PAYDISK_SQL_PROD_ENCRYPT === "true",
    trustServerCertificate: true,
  },
  connectionTimeout: 15000,
  requestTimeout: 60000,
});

const ids = [850, 851, 306];
for (const id of ids) {
  const rs = await pool
    .request()
    .input("id", sql.Int, id)
    .query(`
      SELECT t.Id, t.Title, t.Key1, t.Key2, t.Key3, t.Registrar,
        COL_LENGTH(N'dbo.MakeOverTransactions', N'DefinitionId') AS hasDefCol
      FROM dbo.MakeOverTransactions t WITH (NOLOCK)
      WHERE t.Id=@id
    `);
  const row = rs.recordset[0];
  console.log("\n#" + id, row || null);
  if (!row) continue;

  // DefinitionId if column exists
  try {
    const d = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`
        SELECT t.DefinitionId, d.Code, d.Title, d.SupplyLocationId
        FROM dbo.MakeOverTransactions t WITH (NOLOCK)
        LEFT JOIN dbo.MakeOverDefinitions d WITH (NOLOCK) ON d.Id = t.DefinitionId
        WHERE t.Id=@id
      `);
    console.log("  Definition:", d.recordset[0]);
  } catch (err) {
    console.log("  Definition probe:", err.message.split("\n")[0]);
  }

  const payed = await pool
    .request()
    .input("id", sql.Int, id)
    .query(`
      SELECT COUNT_BIG(*) AS cnt,
        COUNT(DISTINCT MakeOverSupplyLocationId) AS supplies,
        MIN(MakeOverSupplyLocationId) AS minSupply,
        MAX(MakeOverSupplyLocationId) AS maxSupply
      FROM dbo.PayedMakeOvers WITH (NOLOCK)
      WHERE TransactionId=@id
    `);
  console.log("  Payed:", payed.recordset[0]);
}

// Sample recent Key1 patterns for supply 2 / شبانه
const samples = await pool.request().query(`
  SELECT TOP 15 Id, Key1, Title, Registrar,
    CASE
      WHEN TRY_CONVERT(uniqueidentifier, Key1) IS NOT NULL THEN N'GUID'
      WHEN TRY_CONVERT(int, Key1) IS NOT NULL THEN N'INT'
      WHEN Key1 IS NULL OR LTRIM(RTRIM(Key1))=N'' THEN N'EMPTY'
      ELSE N'OTHER'
    END AS key1Kind
  FROM dbo.MakeOverTransactions WITH (NOLOCK)
  WHERE Title LIKE N'%شبانه%'
  ORDER BY Id DESC
`);
console.log("\nRecent شبانه Key1 kinds:");
console.table(samples.recordset);

await pool.close();
