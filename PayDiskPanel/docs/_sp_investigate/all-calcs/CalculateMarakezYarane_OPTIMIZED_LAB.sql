/*
  LAB optimized dbo.CalculateMarakezYarane — یارانه مراکز.

  Old behaviour preserved:
    - DELETE PayedMakeOvers WHERE TransactionId = @TransactionId
    - INSERT from MakeOver ⋈ Center ⋈ Person
    - Filter: MakeOverSupplyLocationId = @SupplyLocationId AND Person.IsDead = 0
    - NewUniversalSubsidy = UniverseSubsidy, Ver = 1
    - CenterAccount / BankId from Center

  Speed:
    - dbo. qualify + NOLOCK on reads
    - Covering index on MakeOver by supply (companion below)
    - PayedMakeOvers already has IX_TransactionId (DELETE)
*/
USE [DB_Mostamary];
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID(N'dbo.MakeOver')
    AND name = N'IX_MakeOver_CalcSupply_Covering'
)
BEGIN
  CREATE NONCLUSTERED INDEX IX_MakeOver_CalcSupply_Covering
    ON dbo.MakeOver (MakeOverSupplyLocationId)
    INCLUDE (
      PersonId, UserRegistrarId, RegistrationDateTime, MakeOverActivityId,
      FromDate, CenterId, Detail, LocalSubsidy, UniverseSubsidy,
      IsNoName, IsSpecial, DefenitionId, Mosharekat
    )
    WITH (MAXDOP = 4);
END
GO

CREATE OR ALTER PROCEDURE [dbo].[CalculateMarakezYarane]
  @TransactionId bigint,
  @SupplyLocationId bigint
AS
BEGIN
  SET NOCOUNT ON;

  BEGIN TRY
    DELETE FROM dbo.PayedMakeOvers
    WHERE TransactionId = @TransactionId;

    INSERT INTO dbo.PayedMakeOvers (
      PersonId, UserRegistrarId, RegistrationDateTime,
      MakeOverSupplyLocationId, MakeOverActivityId, FromDate,
      CenterId, Detail, LocalSubsidy, UniverseSubsidy,
      IsNoName, IsSpecial, DefenitionId, Mosharekat,
      TransactionId, NewUniversalSubsidy, Ver,
      CenterAccount, BankId
    )
    SELECT
      MO.PersonId,
      MO.UserRegistrarId,
      MO.RegistrationDateTime,
      MO.MakeOverSupplyLocationId,
      MO.MakeOverActivityId,
      MO.FromDate,
      cntr.CenterId,
      MO.Detail,
      MO.LocalSubsidy,
      MO.UniverseSubsidy,
      MO.IsNoName,
      MO.IsSpecial,
      MO.DefenitionId,
      MO.Mosharekat,
      @TransactionId,
      MO.UniverseSubsidy,
      1,
      cntr.Account,
      cntr.BankId
    FROM dbo.MakeOver AS MO WITH (NOLOCK)
    INNER JOIN dbo.Center AS cntr WITH (NOLOCK)
      ON cntr.CenterId = MO.CenterId
    INNER JOIN dbo.Person AS Person WITH (NOLOCK)
      ON Person.ID = MO.PersonId
    WHERE MO.MakeOverSupplyLocationId = @SupplyLocationId
      AND Person.IsDead = 0;
  END TRY
  BEGIN CATCH
    THROW;
  END CATCH;
END
GO
