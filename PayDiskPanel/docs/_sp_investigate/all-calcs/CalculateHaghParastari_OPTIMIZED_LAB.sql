/*
  LAB optimized dbo.CalculateHaghParastari — supply 37 (نخاعی).
  Same columns/Money as old; skip whole-table baccountvalidated UPDATE.
*/
USE [DB_Mostamary];
GO

CREATE OR ALTER PROCEDURE [dbo].[CalculateHaghParastari]
  @TrId bigint
AS
BEGIN
  SET NOCOUNT ON;

  UPDATE dbo.PayedTransaction
  SET Description = N'در حال محاسبه....'
  WHERE Id = @TrId;

  BEGIN TRY
    DELETE FROM dbo.PayedContinusPayment WHERE TransactionId = @TrId;

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
    WHERE P.ContinusPaymentSupplyLocationId = 37;
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
