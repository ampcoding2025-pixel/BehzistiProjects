/*
  Preview-then-approve: draft tables + Calculate*_Draft + Promote* (lab / then 155).
  Live Calculate* / Payed* untouched until Promote.
*/
USE [DB_Mostamary];
GO

IF OBJECT_ID(N'dbo.PayedContinusPayment_Draft', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.PayedContinusPayment_Draft (
    Id bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_PayedContinusPayment_Draft PRIMARY KEY,
    PersonId bigint NOT NULL,
    FamilyCount bigint NOT NULL,
    SupplyLocationId bigint NOT NULL,
    BankId bigint NOT NULL,
    AccountNumber nvarchar(50) NOT NULL,
    Money decimal(18,0) NOT NULL,
    TransactionId bigint NOT NULL,
    [Date] datetime NOT NULL,
    CenterRegistrarId bigint NOT NULL,
    DraftAt datetime NOT NULL CONSTRAINT DF_PCP_DraftAt DEFAULT (GETDATE())
  );
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID(N'dbo.PayedContinusPayment_Draft')
    AND name = N'IX_PCP_Draft_TransactionId'
)
BEGIN
  CREATE NONCLUSTERED INDEX IX_PCP_Draft_TransactionId
    ON dbo.PayedContinusPayment_Draft (TransactionId)
    INCLUDE (Money, PersonId, AccountNumber, FamilyCount, SupplyLocationId, CenterRegistrarId, BankId, [Date]);
END
GO

IF OBJECT_ID(N'dbo.PayedMakeOvers_Draft', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.PayedMakeOvers_Draft (
    Id bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_PayedMakeOvers_Draft PRIMARY KEY,
    PersonId bigint NOT NULL,
    UserRegistrarId bigint NOT NULL,
    RegistrationDateTime datetime NOT NULL,
    MakeOverSupplyLocationId bigint NOT NULL,
    MakeOverActivityId bigint NOT NULL,
    FromDate date NOT NULL,
    CenterId bigint NOT NULL,
    Detail nvarchar(50) NOT NULL,
    LocalSubsidy decimal(18,0) NOT NULL,
    UniverseSubsidy decimal(18,0) NOT NULL,
    IsNoName bit NOT NULL,
    IsSpecial bit NOT NULL,
    DefenitionId bigint NOT NULL,
    Mosharekat decimal(18,0) NOT NULL,
    TransactionId int NOT NULL,
    NewUniversalSubsidy decimal(18,0) NULL,
    Ver int NULL,
    CenterAccount nvarchar(50) NULL,
    BankId bigint NULL,
    DraftAt datetime NOT NULL CONSTRAINT DF_PMO_DraftAt DEFAULT (GETDATE())
  );
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID(N'dbo.PayedMakeOvers_Draft')
    AND name = N'IX_PMO_Draft_TransactionId'
)
BEGIN
  CREATE NONCLUSTERED INDEX IX_PMO_Draft_TransactionId
    ON dbo.PayedMakeOvers_Draft (TransactionId)
    INCLUDE (
      PersonId, CenterId, MakeOverSupplyLocationId, LocalSubsidy, UniverseSubsidy,
      CenterAccount, BankId, Detail, Mosharekat
    );
END
GO

/* ---- shared: clear mostamari draft ---- */
IF OBJECT_ID(N'dbo.ClearMostamariDraft', N'P') IS NOT NULL DROP PROCEDURE dbo.ClearMostamariDraft;
GO
CREATE PROCEDURE dbo.ClearMostamariDraft @TrId bigint
AS
BEGIN
  SET NOCOUNT ON;
  DELETE FROM dbo.PayedContinusPayment_Draft WHERE TransactionId = @TrId;
END
GO

IF OBJECT_ID(N'dbo.ClearYaraneDraft', N'P') IS NOT NULL DROP PROCEDURE dbo.ClearYaraneDraft;
GO
CREATE PROCEDURE dbo.ClearYaraneDraft @TransactionId bigint
AS
BEGIN
  SET NOCOUNT ON;
  DELETE FROM dbo.PayedMakeOvers_Draft WHERE TransactionId = @TransactionId;
END
GO

/* ---- CalculateTransaction_Draft ---- */
IF OBJECT_ID(N'dbo.CalculateTransaction_Draft', N'P') IS NOT NULL DROP PROCEDURE dbo.CalculateTransaction_Draft;
GO
CREATE PROCEDURE dbo.CalculateTransaction_Draft @TrId bigint
AS
BEGIN
  SET NOCOUNT ON;
  /* No outer TRAN — same as optimized live CalculateTransaction (~1.5M insert). */

  UPDATE dbo.PayedTransaction SET Description = N'پیش‌نویس محاسبه…' WHERE Id = @TrId;

  BEGIN TRY
    IF EXISTS (
      SELECT 1 FROM dbo.PayedContinusPayment_Draft WITH (NOLOCK) WHERE TransactionId = @TrId
    )
      DELETE FROM dbo.PayedContinusPayment_Draft WHERE TransactionId = @TrId;

    /* TABLOCK helps minimal logging when recovery model allows. */
    INSERT INTO dbo.PayedContinusPayment_Draft WITH (TABLOCK) (
      PersonId, FamilyCount, SupplyLocationId, BankId, AccountNumber,
      Money, TransactionId, Date, CenterRegistrarId
    )
    SELECT
      P.PersonId, P.FamilyCount, P.ContinusPaymentSupplyLocationId,
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
GO

/* ---- CalculateHadafmandi_Draft ---- */
IF OBJECT_ID(N'dbo.CalculateHadafmandi_Draft', N'P') IS NOT NULL DROP PROCEDURE dbo.CalculateHadafmandi_Draft;
GO
CREATE PROCEDURE dbo.CalculateHadafmandi_Draft @TrId bigint
AS
BEGIN
  SET NOCOUNT ON;

  UPDATE dbo.PayedTransaction SET Description = N'پیش‌نویس محاسبه…' WHERE Id = @TrId;

  BEGIN TRY
    IF EXISTS (
      SELECT 1 FROM dbo.PayedContinusPayment_Draft WITH (NOLOCK) WHERE TransactionId = @TrId
    )
      DELETE FROM dbo.PayedContinusPayment_Draft WHERE TransactionId = @TrId;

    INSERT INTO dbo.PayedContinusPayment_Draft WITH (TABLOCK) (
      PersonId, FamilyCount, SupplyLocationId, BankId, AccountNumber,
      Money, TransactionId, Date, CenterRegistrarId
    )
    SELECT
      P.PersonId, P.FamilyCount, P.ContinusPaymentSupplyLocationId,
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
GO

/* ---- single-supply drafts ---- */
IF OBJECT_ID(N'dbo.CalculateEmdad_Draft', N'P') IS NOT NULL DROP PROCEDURE dbo.CalculateEmdad_Draft;
GO
CREATE PROCEDURE dbo.CalculateEmdad_Draft @TrId bigint
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
    SELECT PersonId, FamilyCount, ContinusPaymentSupplyLocationId, BankId, AccountNumber,
           Money, @TrId, GETDATE(), CenterId
    FROM dbo.ContinusPayment WITH (NOLOCK)
    WHERE ContinusPaymentSupplyLocationId = 8;
    DECLARE @cnt bigint = @@ROWCOUNT;
    UPDATE dbo.PayedTransaction SET Description = N'پیش‌نویس آماده ='+ STR(@cnt) + N', ' + CONVERT(nvarchar(100), GETDATE()) WHERE Id = @TrId;
  END TRY
  BEGIN CATCH
    UPDATE dbo.PayedTransaction SET Description = N'خطا در پیش‌نویس: ' + LEFT(ERROR_MESSAGE(), 400) WHERE Id = @TrId;
    THROW;
  END CATCH;
END
GO

IF OBJECT_ID(N'dbo.CalculateHaghParastari_Draft', N'P') IS NOT NULL DROP PROCEDURE dbo.CalculateHaghParastari_Draft;
GO
CREATE PROCEDURE dbo.CalculateHaghParastari_Draft @TrId bigint
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
    SELECT PersonId, FamilyCount, ContinusPaymentSupplyLocationId, BankId, AccountNumber,
           Money, @TrId, GETDATE(), CenterId
    FROM dbo.ContinusPayment WITH (NOLOCK)
    WHERE ContinusPaymentSupplyLocationId = 37;
    DECLARE @cnt bigint = @@ROWCOUNT;
    UPDATE dbo.PayedTransaction SET Description = N'پیش‌نویس آماده ='+ STR(@cnt) + N', ' + CONVERT(nvarchar(100), GETDATE()) WHERE Id = @TrId;
  END TRY
  BEGIN CATCH
    UPDATE dbo.PayedTransaction SET Description = N'خطا در پیش‌نویس: ' + LEFT(ERROR_MESSAGE(), 400) WHERE Id = @TrId;
    THROW;
  END CATCH;
END
GO

IF OBJECT_ID(N'dbo.CalculateHaghParastariFamily_Draft', N'P') IS NOT NULL DROP PROCEDURE dbo.CalculateHaghParastariFamily_Draft;
GO
CREATE PROCEDURE dbo.CalculateHaghParastariFamily_Draft @TrId bigint
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
    SELECT PersonId, FamilyCount, ContinusPaymentSupplyLocationId, BankId, AccountNumber,
           Money, @TrId, GETDATE(), CenterId
    FROM dbo.ContinusPayment WITH (NOLOCK)
    WHERE ContinusPaymentSupplyLocationId = 40;
    DECLARE @cnt bigint = @@ROWCOUNT;
    UPDATE dbo.PayedTransaction SET Description = N'پیش‌نویس آماده ='+ STR(@cnt) + N', ' + CONVERT(nvarchar(100), GETDATE()) WHERE Id = @TrId;
  END TRY
  BEGIN CATCH
    UPDATE dbo.PayedTransaction SET Description = N'خطا در پیش‌نویس: ' + LEFT(ERROR_MESSAGE(), 400) WHERE Id = @TrId;
    THROW;
  END CATCH;
END
GO

/* ---- CalculateMarakezYarane_Draft ---- */
IF OBJECT_ID(N'dbo.CalculateMarakezYarane_Draft', N'P') IS NOT NULL DROP PROCEDURE dbo.CalculateMarakezYarane_Draft;
GO
CREATE PROCEDURE dbo.CalculateMarakezYarane_Draft
  @TransactionId bigint,
  @SupplyLocationId bigint
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    DELETE FROM dbo.PayedMakeOvers_Draft WHERE TransactionId = @TransactionId;
    INSERT INTO dbo.PayedMakeOvers_Draft (
      PersonId, UserRegistrarId, RegistrationDateTime,
      MakeOverSupplyLocationId, MakeOverActivityId, FromDate,
      CenterId, Detail, LocalSubsidy, UniverseSubsidy,
      IsNoName, IsSpecial, DefenitionId, Mosharekat,
      TransactionId, NewUniversalSubsidy, Ver, CenterAccount, BankId
    )
    SELECT
      MO.PersonId, MO.UserRegistrarId, MO.RegistrationDateTime,
      MO.MakeOverSupplyLocationId, MO.MakeOverActivityId, MO.FromDate,
      cntr.CenterId, ISNULL(MO.Detail, N''), MO.LocalSubsidy, MO.UniverseSubsidy,
      MO.IsNoName, MO.IsSpecial, MO.DefenitionId, MO.Mosharekat,
      @TransactionId, MO.UniverseSubsidy, 1, cntr.Account, cntr.BankId
    FROM dbo.MakeOver AS MO WITH (NOLOCK)
    INNER JOIN dbo.Center AS cntr WITH (NOLOCK) ON cntr.CenterId = MO.CenterId
    INNER JOIN dbo.Person AS Person WITH (NOLOCK) ON Person.ID = MO.PersonId
    WHERE MO.MakeOverSupplyLocationId = @SupplyLocationId
      AND Person.IsDead = 0;
  END TRY
  BEGIN CATCH
    THROW;
  END CATCH;
END
GO

/* ---- PromoteMostamariDraft: live Payed + IT sync (base/hadaf style) ---- */
IF OBJECT_ID(N'dbo.PromoteMostamariDraft', N'P') IS NOT NULL DROP PROCEDURE dbo.PromoteMostamariDraft;
GO
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

    IF EXISTS (
      SELECT 1 FROM dbo.PayedContinusPayment WITH (NOLOCK) WHERE TransactionId = @TrId
    )
      DELETE FROM dbo.PayedContinusPayment WHERE TransactionId = @TrId;

    INSERT INTO dbo.PayedContinusPayment WITH (TABLOCK) (
      PersonId, FamilyCount, SupplyLocationId, BankId, AccountNumber,
      Money, TransactionId, Date, CenterRegistrarId
    )
    SELECT
      PersonId, FamilyCount, SupplyLocationId, BankId, AccountNumber,
      Money, TransactionId, Date, CenterRegistrarId
    FROM dbo.PayedContinusPayment_Draft WITH (NOLOCK)
    WHERE TransactionId = @TrId;

    DECLARE @cnt bigint = @@ROWCOUNT;

    /* Optional — off by default; IT join is the main approve cost. */
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

    /* Keep draft rows for post-approve draft↔live compare; next Calculate*_Draft clears them. */

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
GO

/* ---- PromoteYaraneDraft ---- */
IF OBJECT_ID(N'dbo.PromoteYaraneDraft', N'P') IS NOT NULL DROP PROCEDURE dbo.PromoteYaraneDraft;
GO
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

    /* Keep draft for draft↔live compare; next Calculate*_Draft / ClearYaraneDraft clears. */

    COMMIT;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    THROW;
  END CATCH;
END
GO
