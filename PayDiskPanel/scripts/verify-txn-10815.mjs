import { createRequire } from "module";
import { loadEnvLocal } from "./_load-env-local.mjs";

const require = createRequire(process.cwd() + "/package.json");
const env = loadEnvLocal(import.meta.url);
const sql = require("mssql/msnodesqlv8");
const cs = `Driver={ODBC Driver 18 for SQL Server};Server=${env.PAYDISK_TEST_SQL_HOST || "10.0.28.10"};Database=${env.PAYDISK_TEST_SQL_DATABASE || "DB_Mostamary"};Trusted_Connection=Yes;Encrypt=yes;TrustServerCertificate=yes;`;

const pool = await new sql.ConnectionPool({
  connectionString: cs,
  connectionTimeout: 20_000,
  requestTimeout: 180_000,
}).connect();

const header = await pool.request().query(`
  SELECT Id, Title, Ky, Year, AcceptorUserId, AcceptanceDateTime,
    LEFT(CONVERT(nvarchar(300), Description), 200) AS Description
  FROM dbo.PayedTransaction WITH (NOLOCK)
  WHERE Id IN (10815, 10813, 10814)
`);
console.log("headers", JSON.stringify(header.recordset, null, 2));

for (const id of [10815, 10813]) {
  const r = await pool.request().query(`
    SELECT
      COUNT_BIG(*) AS cnt,
      SUM(CONVERT(bigint, Money)) AS moneySum,
      COUNT(DISTINCT Money) AS moneyKinds,
      COUNT(DISTINCT FamilyCount) AS familyKinds
    FROM dbo.PayedContinusPayment WITH (NOLOCK)
    WHERE TransactionId = ${id}
  `);
  console.log(`payed ${id}`, r.recordset[0]);
}

await pool.close();
