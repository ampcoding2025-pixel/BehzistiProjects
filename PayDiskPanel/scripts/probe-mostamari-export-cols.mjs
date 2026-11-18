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
  requestTimeout: 120000,
});

console.log("Connected", host, database, "as", env.PAYDISK_SQL_USER);

const names = [
  "ListExporMarakez",
  "ListExportContinus",
  "ListExporContinus",
  "ListExportPayment",
  "ExportContinusPayment",
  "GetListContinus",
  "GetListPayment",
  "ListExporPayment",
  "ExportPayedContinus",
  "MakeExcelContinus",
  "ExportExcelContinus",
  "ListExporMostamari",
  "ListExportMostamari",
  "ExportMostamari",
  "GetExcelContinus",
  "ListExporBank",
];

for (const n of names) {
  const r = await pool.request().query(`
    SELECT
      OBJECT_ID(N'dbo.${n}') AS oid,
      CASE
        WHEN OBJECT_ID(N'dbo.${n}') IS NULL THEN NULL
        ELSE LEN(OBJECT_DEFINITION(OBJECT_ID(N'dbo.${n}')))
      END AS defLen
  `);
  console.log(n, r.recordset[0]);
}

const def = await pool.request().query(`
  SELECT OBJECT_DEFINITION(OBJECT_ID(N'dbo.ListExporMarakez')) AS def
`);
const t = String(def.recordset[0]?.def || "");
console.log("\nListExporMarakez len", t.length);
if (t) {
  for (const needle of ["Continus", "FirstName", "AccountNumber", "IBN", "BCP"]) {
    const i = t.indexOf(needle);
    console.log(`\n--- ${needle} @ ${i} ---`);
    if (i >= 0) console.log(t.slice(Math.max(0, i - 120), i + 700));
  }
}

// Ops-doc people-list shape used by Armaghan Excel for nursing/emdad
const sample = await pool.request().query(`
  SELECT TOP 1
    p.Id, p.PersonId, p.AccountNumber, p.Money, p.FamilyCount, p.SupplyLocationId,
    Person.NID, Person.FirstName, Person.LastName,
    Center.CenterTitle, City.CityTitle, Province.ProvinceTitle,
    LTRIM(RTRIM(i.IBN)) AS ibn
  FROM dbo.PayedContinusPayment AS p WITH (NOLOCK)
  INNER JOIN dbo.Person WITH (NOLOCK) ON p.PersonId = Person.ID
  INNER JOIN dbo.Center WITH (NOLOCK) ON p.CenterRegistrarId = Center.CenterId
  INNER JOIN dbo.City WITH (NOLOCK) ON Center.CityID = City.CityId
  INNER JOIN dbo.Province WITH (NOLOCK) ON City.ProvinceId = Province.ProvinceId
  LEFT JOIN dbo.IBN_AccountNumber AS i WITH (NOLOCK)
    ON LTRIM(RTRIM(p.AccountNumber)) = LTRIM(RTRIM(i.AccountNumber))
  WHERE p.TransactionId IN (
    SELECT TOP 1 Id FROM dbo.PayedTransaction WITH (NOLOCK)
    WHERE Ky IN (N'Mst_Emdad', N'Mst_PARASTARI', N'Mst_F_PRSTRI', N'Mst_131500')
    ORDER BY Id DESC
  )
`);
console.log("\n=== Sample ops-doc list row keys ===");
console.log(sample.recordset[0] ? Object.keys(sample.recordset[0]) : "(no row)");
console.log(sample.recordset[0]);

await pool.close();
