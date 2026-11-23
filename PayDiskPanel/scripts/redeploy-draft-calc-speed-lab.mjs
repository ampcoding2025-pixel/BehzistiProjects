/**
 * Redeploy faster Calculate*_Draft SPs (TABLOCK, @@ROWCOUNT, skip empty DELETE).
 * Lab + prod (155) when write login is present.
 */
import { createRequire } from "module";
import { loadEnvLocal } from "./_load-env-local.mjs";

const require = createRequire(process.cwd() + "/package.json");
const env = loadEnvLocal(import.meta.url);

const batches = [
  `IF OBJECT_ID(N'dbo.CalculateTransaction_Draft', N'P') IS NOT NULL DROP PROCEDURE dbo.CalculateTransaction_Draft;`,
  `
CREATE PROCEDURE dbo.CalculateTransaction_Draft @TrId bigint
AS
BEGIN
  SET NOCOUNT ON;
  UPDATE dbo.PayedTransaction SET Description = N'پیش‌نویس محاسبه…' WHERE Id = @TrId;
  BEGIN TRY
    IF EXISTS (SELECT 1 FROM dbo.PayedContinusPayment_Draft WITH (NOLOCK) WHERE TransactionId = @TrId)
      DELETE FROM dbo.PayedContinusPayment_Draft WHERE TransactionId = @TrId;
    INSERT INTO dbo.PayedContinusPayment_Draft WITH (TABLOCK) (
      PersonId, FamilyCount, SupplyLocationId, BankId, AccountNumber,
      Money, TransactionId, Date, CenterRegistrarId
    )
    SELECT P.PersonId, P.FamilyCount, P.ContinusPaymentSupplyLocationId,
           P.BankId, P.AccountNumber, P.Money, @TrId, GETDATE(), P.CenterId
    FROM dbo.ContinusPayment AS P WITH (NOLOCK)
    WHERE P.ContinusPaymentSupplyLocationId IN (
      1,2,3,4,9,10,11,12,13,14,15,16,17,18,19,20,
      21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,38
    );
    DECLARE @cnt bigint = @@ROWCOUNT;
    UPDATE dbo.PayedTransaction
    SET Description = N'پیش‌نویس آماده ='+ STR(@cnt) + N', ' + CONVERT(nvarchar(100), GETDATE())
    WHERE Id = @TrId;
  END TRY
  BEGIN CATCH
    UPDATE dbo.PayedTransaction
    SET Description = N'خطا در پیش‌نویس: ' + LEFT(ERROR_MESSAGE(), 400)
    WHERE Id = @TrId;
    THROW;
  END CATCH;
END
`,
  `IF OBJECT_ID(N'dbo.CalculateHadafmandi_Draft', N'P') IS NOT NULL DROP PROCEDURE dbo.CalculateHadafmandi_Draft;`,
  `
CREATE PROCEDURE dbo.CalculateHadafmandi_Draft @TrId bigint
AS
BEGIN
  SET NOCOUNT ON;
  UPDATE dbo.PayedTransaction SET Description = N'پیش‌نویس محاسبه…' WHERE Id = @TrId;
  BEGIN TRY
    IF EXISTS (SELECT 1 FROM dbo.PayedContinusPayment_Draft WITH (NOLOCK) WHERE TransactionId = @TrId)
      DELETE FROM dbo.PayedContinusPayment_Draft WHERE TransactionId = @TrId;
    INSERT INTO dbo.PayedContinusPayment_Draft WITH (TABLOCK) (
      PersonId, FamilyCount, SupplyLocationId, BankId, AccountNumber,
      Money, TransactionId, Date, CenterRegistrarId
    )
    SELECT P.PersonId, P.FamilyCount, P.ContinusPaymentSupplyLocationId,
           P.BankId, P.AccountNumber, P.Money, @TrId, GETDATE(), P.CenterId
    FROM dbo.ContinusPayment AS P WITH (NOLOCK)
    WHERE P.ContinusPaymentSupplyLocationId IN (
      1,2,3,4,5,6,7,9,10,11,12,13,14,15,16,17,18,19,20,
      21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,38
    );
    DECLARE @cnt bigint = @@ROWCOUNT;
    UPDATE dbo.PayedTransaction
    SET Description = N'پیش‌نویس آماده ='+ STR(@cnt) + N', ' + CONVERT(nvarchar(100), GETDATE())
    WHERE Id = @TrId;
  END TRY
  BEGIN CATCH
    UPDATE dbo.PayedTransaction
    SET Description = N'خطا در پیش‌نویس: ' + LEFT(ERROR_MESSAGE(), 400)
    WHERE Id = @TrId;
    THROW;
  END CATCH;
END
`,
];

async function run(label, poolFactory) {
  const pool = await poolFactory();
  try {
    for (const b of batches) {
      await pool.request().batch(b);
    }
    console.log(label, "Calculate*_Draft speed OK");
  } finally {
    await pool.close();
  }
}

await run("lab", async () => {
  const sql = require("mssql/msnodesqlv8");
  const cs = `Driver={ODBC Driver 18 for SQL Server};Server=${env.PAYDISK_TEST_SQL_HOST || "10.0.28.10"};Database=${env.PAYDISK_TEST_SQL_DATABASE || "DB_Mostamary"};Trusted_Connection=Yes;Encrypt=yes;TrustServerCertificate=yes;`;
  return new sql.ConnectionPool({
    connectionString: cs,
    requestTimeout: 120000,
  }).connect();
});

{
  const sql = require("mssql");
  const user = (env.PAYDISK_SQL_WRITE_USER || "").trim();
  const password = env.PAYDISK_SQL_WRITE_PASSWORD_B64
    ? Buffer.from(env.PAYDISK_SQL_WRITE_PASSWORD_B64, "base64").toString("utf8")
    : "";
  if (!user || !password) {
    console.log("skip prod — no write login");
  } else {
    await run("prod", async () =>
      sql.connect({
        server: env.PAYDISK_SQL_HOST || "10.1.0.155",
        database: env.PAYDISK_SQL_PROD_DATABASE || "DB_Mostamary",
        user,
        password,
        options: { encrypt: false, trustServerCertificate: true },
        requestTimeout: 120000,
      }),
    );
  }
}
