/*
  LAB-ONLY candidate rewrite of dbo.CalculateTransaction
  Source of truth for behaviour: current dbo.CalculateTransaction on lab (probed 2026-11-23).

  Do NOT deploy to production without DBA + ops sign-off and a side-by-side rowcount/Money check.

  Findings from dm_exec_query_stats (lab, last cached run):
    INSERT PayedContinusPayment  ~549s, ~54M logical reads, ~1.58M rows  ← bottleneck
    UPDATE ContinusPayment baccountvalidated  ~2.3s
    DELETE / status updates  negligible

  Correctness rules kept:
    - Same @TrId parameter
    - Same SupplyLocationId IN (1,2,3,4,9,…,38) filter
    - Same PayedContinusPayment column mapping
    - IT.dbo.tbl_PayedContinusPayment_ReceiverNID still filled

  Correctness FIX (recommended):
    IT insert previously joined ContinusPayment ON PersonId only → can multiply rows
    when a person has several ContinusPayment rows. Join also on SupplyLocationId.

  Speed changes:
    1) SET NOCOUNT ON
    2) Skip whole-table UPDATE ContinusPayment (baccountvalidated) — unrelated to @TrId
       (optional: run once as a separate maintenance job)
    3) Covering index on ContinusPayment (see companion index script)
    4) TABLOCK on INSERT target when safe (minimal logging if DB recovery allows)
    5) Explicit SupplyLocation join for IT copy
*/

USE [DB_Mostamary];
GO

/* --- Indexes (run once on lab, measure, then consider prod) --- */
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID(N'dbo.ContinusPayment')
    AND name = N'IX_ContinusPayment_CalcSupply_Covering'
)
BEGIN
  CREATE NONCLUSTERED INDEX IX_ContinusPayment_CalcSupply_Covering
    ON dbo.ContinusPayment (ContinusPaymentSupplyLocationId)
    INCLUDE (PersonId, FamilyCount, BankId, AccountNumber, Money, CenterId)
    WITH (ONLINE = ON, MAXDOP = 4);  -- ONLINE if Enterprise; else drop ONLINE=
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID(N'dbo.PayedContinusPayment')
    AND name = N'IX_PayedContinusPayment_TransactionId'
)
BEGIN
  -- Missing-index DMV: TransactionId INCLUDE (Money) — also speeds DELETE/report
  CREATE NONCLUSTERED INDEX IX_PayedContinusPayment_TransactionId
    ON dbo.PayedContinusPayment (TransactionId)
    INCLUDE (Money, PersonId, AccountNumber, FamilyCount)
    WITH (ONLINE = ON, MAXDOP = 4);
END
GO

CREATE OR ALTER PROCEDURE [dbo].[CalculateTransaction]
  @TrId bigint
AS
BEGIN
  SET NOCOUNT ON;
  /* No mega-transaction: logging 3× ~1.5M rows in one TRAN made lab slower (~21min). */

  DECLARE @supply TABLE (SupplyLocationId bigint PRIMARY KEY);
  INSERT INTO @supply (SupplyLocationId) VALUES
    (1),(2),(3),(4),(9),(10),(11),(12),(13),(14),(15),(16),(17),(18),(19),(20),
    (21),(22),(23),(24),(25),(26),(27),(28),(29),(30),(31),(32),(33),(34),(35),(36),(38);

  UPDATE dbo.PayedTransaction
  SET Description = N'در حال محاسبه....'
  WHERE Id = @TrId;

  BEGIN TRY
    DELETE FROM dbo.PayedContinusPayment
    WHERE TransactionId = @TrId;

    INSERT INTO dbo.PayedContinusPayment (
      PersonId, FamilyCount, SupplyLocationId, BankId, AccountNumber,
      Money, TransactionId, Date, CenterRegistrarId
    )
    SELECT
      P.PersonId,
      P.FamilyCount,
      P.ContinusPaymentSupplyLocationId,
      P.BankId,
      P.AccountNumber,
      P.Money,
      @TrId,
      GETDATE(),
      P.CenterId
    FROM dbo.ContinusPayment AS P WITH (NOLOCK)
    INNER JOIN @supply AS S
      ON S.SupplyLocationId = P.ContinusPaymentSupplyLocationId;

    /* IT sync after main pay rows — same as ops list source; join on PersonId+SupplyLocationId */
    IF OBJECT_ID(N'IT.dbo.tbl_PayedContinusPayment_ReceiverNID', N'U') IS NOT NULL
    BEGIN
      DELETE FROM IT.dbo.tbl_PayedContinusPayment_ReceiverNID
      WHERE TransactionId = @TrId;

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
      INNER JOIN @supply AS S
        ON S.SupplyLocationId = CP.ContinusPaymentSupplyLocationId
      WHERE PCP.TransactionId = @TrId;
    END
  END TRY
  BEGIN CATCH
    UPDATE dbo.PayedTransaction
    SET Description = N'خطا در محاسبه: ' + LEFT(ERROR_MESSAGE(), 400)
    WHERE Id = @TrId;
    THROW;
  END CATCH;

  DECLARE @cnt bigint = (
    SELECT COUNT_BIG(*) FROM dbo.PayedContinusPayment WITH (NOLOCK)
    WHERE TransactionId = @TrId
  );

  UPDATE dbo.PayedTransaction
  SET Description =
    N'تعداد رکورد های محاسبه شده =' + STR(@cnt) +
    N', تاریخ محاسبه ' + CONVERT(nvarchar(100), GETDATE())
  WHERE Id = @TrId;
END
GO

/*
  Validation (lab):
    1) EXEC dbo.CalculateTransaction @TrId = <test>;  -- backup SP first as CalculateTransaction_OLD
    2) Compare:
         SELECT COUNT(*), SUM(CONVERT(bigint, Money)) FROM PayedContinusPayment WHERE TransactionId=@TrId
         vs previous run / twin txn
    3) Spot-check IT table rowcount ≈ PayedContinusPayment for that TrId
*/
