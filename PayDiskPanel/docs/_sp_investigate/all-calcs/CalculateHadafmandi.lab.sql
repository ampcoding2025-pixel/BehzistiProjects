-- =============================================
-- Author:		<Author,,Name>
-- Create date: <Create Date,,>
-- Description:	<Description,,>
-- =============================================
CREATE PROCEDURE [dbo].[CalculateHadafmandi]
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
      ,p.Money
	  
	--  case P.Money
	--when 2730000 then 2730000
	--when 3900000 then 3900000
	--when 5460000 then 5460000
	--when 7020000 then 7020000
	--when 8580000 then 8580000

	--else 0
	--end as Money
	
      ,@TrId as [TransactionId]
      ,GetDate() as  [Date]
      ,P.CenterId as [CenterRegistrarId] 
	  from DB_Mostamary.dbo.ContinusPayment as P where ContinusPaymentSupplyLocationId in (5,6,7,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,38)

	 

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
	  ,p.Money
 --     ,	case P.Money
 --     when 2730000 then 2730000
	--when 3900000 then 3900000
	--when 5460000 then 5460000
	--when 7020000 then 7020000
	--when 8580000 then 8580000

	--else 0
	--end as Money
      ,@TrId as [TransactionId]
      ,GetDate() as  [Date]
      ,P.CenterId as [CenterRegistrarId] 
	  from DB_Mostamary.dbo.ContinusPayment as P where ContinusPaymentSupplyLocationId<=4

	  
	  --Insert into DB_Mostamary.dbo.PayedContinusPayment
   --  (  [PersonId]
   --   ,[FamilyCount]
   --   ,[SupplyLocationId]
   --   ,[BankId]
   --   ,[AccountNumber]
   --   ,[Money]
   --   ,[TransactionId]
   --   ,[Date]
   --   ,[CenterRegistrarId])
	  --select  [PersonId]
   --   ,[FamilyCount]
   --   ,P.ContinusPaymentSupplyLocationId as [SupplyLocationId]
   --   ,[BankId]
   --   ,[AccountNumber]
   --   ,	1750000 as Money
   --   ,@TrId as [TransactionId]
   --   ,GetDate() as  [Date]
   --   ,P.CenterId as [CenterRegistrarId] 
	  --from DB_Mostamary.dbo.ContinusPayment as P where ContinusPaymentSupplyLocationId=8



	  --update PayedContinusPayment set Money=(select top 1 NEWMONEY from PKK where PKK.PersonId=PayedContinusPayment.PersonId) 
	  --where PayedContinusPayment.PersonId in (select PersonId from PKK) and PayedContinusPayment.TransactionId=@TrId

	Insert into it.dbo.tbl_PayedContinusPayment_ReceiverNID
	( Id, PersonId, FamilyCount, SupplyLocationId, BankId, AccountNumber, Money, TransactionId, Date, CenterRegistrarId, ContinusPaymentId, EndDate, AcceptorUserId, IsActive, RegistrationReasonId, IntroducerId, ReceiverNID, 
                         ReceiverTitle, StartDate, RegistrarUserId, RegistrationDate)
		SELECT     PayedContinusPayment.Id, PayedContinusPayment.PersonId, PayedContinusPayment.FamilyCount, PayedContinusPayment.SupplyLocationId, PayedContinusPayment.BankId, PayedContinusPayment.AccountNumber, 
                         PayedContinusPayment.Money, PayedContinusPayment.TransactionId, PayedContinusPayment.Date, PayedContinusPayment.CenterRegistrarId, ContinusPayment.ContinusPaymentId, ContinusPayment.EndDate, 
                         ContinusPayment.AcceptorUserId, ContinusPayment.IsActive, ContinusPayment.RegistrationReasonId, ContinusPayment.IntroducerId, ContinusPayment.ReceiverNID, 
                         ContinusPayment.ReceiverTitle, ContinusPayment.StartDate, ContinusPayment.RegistrarUserId, ContinusPayment.RegistrationDate
						 FROM            PayedContinusPayment INNER JOIN
						 ContinusPayment ON PayedContinusPayment.PersonId = ContinusPayment.PersonId
						 WHERE        (PayedContinusPayment.TransactionId =  @TrId) and  ContinusPaymentSupplyLocationId in (
	  1,2,3,4,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,38
	  )



	  	declare @cnt  bigint = (select count(*) from PayedContinusPayment where TransactionId=@TrId)
	update PayedTransaction set Description = N'تعداد رکورد های محاسبه شده ='+ str(@cnt) + ', تاریخ محاسبه '+Convert(nvarchar(100), GetDate())  where id=@TrId

END


