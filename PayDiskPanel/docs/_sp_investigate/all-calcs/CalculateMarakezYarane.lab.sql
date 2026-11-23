


-- =============================================
-- Author:		<Author,,Name>
-- Create date: <Create Date,,>
-- Description:	<Description,,>
-- =============================================
CREATE PROCEDURE [dbo].[CalculateMarakezYarane] 
	-- Add the parameters for the stored procedure here
	@TransactionId bigint ,
	@SupplyLocationId bigint
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

    -- Insert statements for procedure here
	delete DB_Mostamary.dbo.PayedMakeOvers where TransactionId=@TransactionId
	
	insert into DB_Mostamary.dbo.PayedMakeOvers
(      [PersonId]
      ,[UserRegistrarId]
      ,[RegistrationDateTime]
      ,[MakeOverSupplyLocationId]
      ,[MakeOverActivityId]
      ,[FromDate]
      ,[CenterId]
      ,[Detail]
      ,[LocalSubsidy]
      ,[UniverseSubsidy]
      ,[IsNoName]
      ,[IsSpecial]
      ,[DefenitionId]
      ,[Mosharekat]
      ,[TransactionId]
      ,[NewUniversalSubsidy]
      ,[Ver]
	  ,[CenterAccount]
	  ,[BankId] )
 
  SELECT     MakeOver.PersonId, MakeOver.UserRegistrarId, MakeOver.RegistrationDateTime,
  MakeOver.MakeOverSupplyLocationId, MakeOver.MakeOverActivityId, MakeOver.FromDate, 
  cntr.CenterId, MakeOver.Detail, MakeOver.LocalSubsidy, MakeOver.UniverseSubsidy,
  MakeOver.IsNoName, 
                  MakeOver.IsSpecial, MakeOver.DefenitionId,  MakeOver.Mosharekat,
				  @TransactionId as [TransactionId]
      , [UniverseSubsidy] as [NewUniversalSubsidy],
				 1 AS Ver, cntr.Account AS CenterAccount, cntr.BankId
				    
FROM        MakeOver INNER JOIN
                  Center AS cntr ON cntr.CenterId = MakeOver.CenterId INNER JOIN
                  Person ON MakeOver.PersonId = Person.ID  
WHERE    [MakeOverSupplyLocationId]=@SupplyLocationId AND (Person.IsDead = 0)


END
