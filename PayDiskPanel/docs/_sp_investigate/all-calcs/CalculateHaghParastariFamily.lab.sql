-- =============================================
-- Author:		<Author,,Name>
-- Create date: <Create Date,,>
-- Description:	<Description,,>
-- =============================================
Create PROCEDURE [dbo].HaghParastariFamily
	-- Add the parameters for the stored procedure here
		@TrId bigint
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
		update PayedTransaction set Description = N'در حال محاسبه....' where id=@TrId

    -- Insert statements for procedure here
	delete DB_Mostamary.dbo.PayedContinusPayment where TransactionId=@TrId

	update DB_Mostamary.dbo.ContinusPayment set baccountvalidated=1 where baccountvalidated is null
    -- Insert statements for procedure here
	Insert into DB_Mostamary.dbo.PayedContinusPayment
     (  [PersonId]
      ,[FamilyCount]
      ,[SupplyLocationId]
      ,[BankId]
      ,[AccountNumber]
      ,[Money]
      ,[TransactionId]
      ,[Date]
      ,[CenterRegistrarId])
	  select  [PersonId]
      ,[FamilyCount]
      ,P.ContinusPaymentSupplyLocationId as [SupplyLocationId]
      ,[BankId]
      ,[AccountNumber]
      ,[Money]
      ,@TrId as [TransactionId]
      ,GetDate() as  [Date]
      ,P.CenterId as [CenterRegistrarId] 
	  from DB_Mostamary.dbo.ContinusPayment as P where ContinusPaymentSupplyLocationId in (40)



	  	declare @cnt  bigint = (select count(*) from PayedContinusPayment where TransactionId=@TrId)
	update PayedTransaction set Description = N'تعداد رکورد های محاسبه شده ='+ str(@cnt) + ', تاریخ محاسبه '+Convert(nvarchar(100), GetDate())  where id=@TrId

END
