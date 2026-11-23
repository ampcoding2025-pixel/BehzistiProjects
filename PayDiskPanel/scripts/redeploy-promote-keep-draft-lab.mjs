/** Lab+prod: Promote* keeps draft rows for draft↔live compare. */
import { createRequire } from "module";
import { loadEnvLocal } from "./_load-env-local.mjs";

const require = createRequire(process.cwd() + "/package.json");
const env = loadEnvLocal(import.meta.url);

const alterMostamari = `
IF OBJECT_ID(N'dbo.PromoteMostamariDraft', N'P') IS NOT NULL
  DROP PROCEDURE dbo.PromoteMostamariDraft;
`;
const createMostamari = `
CREATE PROCEDURE dbo.PromoteMostamariDraft
  @TrId bigint,
  @SyncIt bit = 0
AS
BEGIN
  SET NOCOUNT ON;
  IF NOT EXISTS (SELECT 1 FROM dbo.PayedContinusPayment_Draft WITH (NOLOCK) WHERE TransactionId = @TrId)
  BEGIN
    RAISERROR(N'پیش‌نویس خالی است — ابتدا محاسبه پیش‌نویس را اجرا کنید', 16, 1);
    RETURN;
  END;
  BEGIN TRY
    BEGIN TRAN;
    /* Skip DELETE when live empty — common first-approve path. */
    IF EXISTS (
      SELECT 1 FROM dbo.PayedContinusPayment WITH (NOLOCK) WHERE TransactionId = @TrId
    )
      DELETE FROM dbo.PayedContinusPayment WHERE TransactionId = @TrId;

    INSERT INTO dbo.PayedContinusPayment WITH (TABLOCK) (
      PersonId, FamilyCount, SupplyLocationId, BankId, AccountNumber,
      Money, TransactionId, Date, CenterRegistrarId
    )
    SELECT PersonId, FamilyCount, SupplyLocationId, BankId, AccountNumber,
           Money, TransactionId, Date, CenterRegistrarId
    FROM dbo.PayedContinusPayment_Draft WITH (NOLOCK)
    WHERE TransactionId = @TrId;

    DECLARE @cnt bigint = @@ROWCOUNT;

    IF @SyncIt = 1 AND OBJECT_ID(N'IT.dbo.tbl_PayedContinusPayment_ReceiverNID', N'U') IS NOT NULL
    BEGIN
      DECLARE @itSupply TABLE (SupplyLocationId bigint PRIMARY KEY);
      INSERT INTO @itSupply (SupplyLocationId) VALUES
        (1),(2),(3),(4),(9),(10),(11),(12),(13),(14),(15),(16),(17),(18),(19),(20),
        (21),(22),(23),(24),(25),(26),(27),(28),(29),(30),(31),(32),(33),(34),(35),(36),(38);
      DELETE FROM IT.dbo.tbl_PayedContinusPayment_ReceiverNID WHERE TransactionId = @TrId;
      INSERT INTO IT.dbo.tbl_PayedContinusPayment_ReceiverNID (
        Id, PersonId, FamilyCount, SupplyLocationId, BankId, AccountNumber, Money,
        TransactionId, Date, CenterRegistrarId, ContinusPaymentId, EndDate,
        AcceptorUserId, IsActive, RegistrationReasonId, IntroducerId, ReceiverNID,
        ReceiverTitle, StartDate, RegistrarUserId, RegistrationDate
      )
      SELECT
        PCP.Id, PCP.PersonId, PCP.FamilyCount, PCP.SupplyLocationId, PCP.BankId,
        PCP.AccountNumber, PCP.Money, PCP.TransactionId, PCP.Date, PCP.CenterRegistrarId,
        CP.ContinusPaymentId, CP.EndDate, CP.AcceptorUserId, CP.IsActive,
        CP.RegistrationReasonId, CP.IntroducerId, CP.ReceiverNID, CP.ReceiverTitle,
        CP.StartDate, CP.RegistrarUserId, CP.RegistrationDate
      FROM dbo.PayedContinusPayment AS PCP WITH (NOLOCK)
      INNER JOIN dbo.ContinusPayment AS CP WITH (NOLOCK)
        ON CP.PersonId = PCP.PersonId
       AND CP.ContinusPaymentSupplyLocationId = PCP.SupplyLocationId
      INNER JOIN @itSupply AS S ON S.SupplyLocationId = PCP.SupplyLocationId
      WHERE PCP.TransactionId = @TrId;
    END

    UPDATE dbo.PayedTransaction
    SET Description = N'تایید/ارتقا پیش‌نویس ='+ STR(@cnt) + N', ' + CONVERT(nvarchar(100), GETDATE())
    WHERE Id = @TrId;
    COMMIT;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    UPDATE dbo.PayedTransaction
    SET Description = N'خطا در ارتقا پیش‌نویس: ' + LEFT(ERROR_MESSAGE(), 400)
    WHERE Id = @TrId;
    THROW;
  END CATCH;
END
`;

const alterYarane = `
IF OBJECT_ID(N'dbo.PromoteYaraneDraft', N'P') IS NOT NULL
  DROP PROCEDURE dbo.PromoteYaraneDraft;
`;
const createYarane = `
CREATE PROCEDURE dbo.PromoteYaraneDraft @TransactionId bigint
AS
BEGIN
  SET NOCOUNT ON;
  IF NOT EXISTS (SELECT 1 FROM dbo.PayedMakeOvers_Draft WITH (NOLOCK) WHERE TransactionId = @TransactionId)
  BEGIN
    RAISERROR(N'پیش‌نویس یارانه خالی است', 16, 1);
    RETURN;
  END;
  BEGIN TRY
    BEGIN TRAN;
    DELETE FROM dbo.PayedMakeOvers WHERE TransactionId = @TransactionId;
    INSERT INTO dbo.PayedMakeOvers (
      PersonId, UserRegistrarId, RegistrationDateTime,
      MakeOverSupplyLocationId, MakeOverActivityId, FromDate,
      CenterId, Detail, LocalSubsidy, UniverseSubsidy,
      IsNoName, IsSpecial, DefenitionId, Mosharekat,
      TransactionId, NewUniversalSubsidy, Ver, CenterAccount, BankId
    )
    SELECT
      PersonId, UserRegistrarId, RegistrationDateTime,
      MakeOverSupplyLocationId, MakeOverActivityId, FromDate,
      CenterId, Detail, LocalSubsidy, UniverseSubsidy,
      IsNoName, IsSpecial, DefenitionId, Mosharekat,
      TransactionId, NewUniversalSubsidy, Ver, CenterAccount, BankId
    FROM dbo.PayedMakeOvers_Draft WITH (NOLOCK)
    WHERE TransactionId = @TransactionId;
    COMMIT;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    THROW;
  END CATCH;
END
`;

async function deployLab() {
  const sql = require("mssql/msnodesqlv8");
  const cs = `Driver={ODBC Driver 18 for SQL Server};Server=${env.PAYDISK_TEST_SQL_HOST || "10.0.28.10"};Database=${env.PAYDISK_TEST_SQL_DATABASE || "DB_Mostamary"};Trusted_Connection=Yes;Encrypt=yes;TrustServerCertificate=yes;`;
  const pool = await new sql.ConnectionPool({ connectionString: cs, requestTimeout: 120000 }).connect();
  for (const b of [alterMostamari, createMostamari, alterYarane, createYarane]) {
    await pool.request().batch(b);
  }
  console.log("lab Promote* keep-draft OK");
  await pool.close();
}

async function deployProd() {
  const sql = require("mssql");
  const user = (env.PAYDISK_SQL_WRITE_USER || "").trim();
  const password = env.PAYDISK_SQL_WRITE_PASSWORD_B64
    ? Buffer.from(env.PAYDISK_SQL_WRITE_PASSWORD_B64, "base64").toString("utf8")
    : "";
  if (!user || !password) {
    console.log("skip prod — no write login");
    return;
  }
  const pool = await sql.connect({
    server: env.PAYDISK_SQL_HOST || "10.1.0.155",
    database: env.PAYDISK_SQL_PROD_DATABASE || "DB_Mostamary",
    user,
    password,
    options: { encrypt: false, trustServerCertificate: true },
    requestTimeout: 120000,
  });
  for (const b of [alterMostamari, createMostamari, alterYarane, createYarane]) {
    await pool.request().batch(b);
  }
  console.log("prod Promote* keep-draft OK");
  await pool.close();
}

await deployLab();
await deployProd();
