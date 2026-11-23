CREATE PROCEDURE [dbo].[CalculateTransaction]
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