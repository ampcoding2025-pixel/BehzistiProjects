
-- =============================================
-- Author:		<Author,,Name>
-- Create date: <Create Date,,>
-- Description:	<Description,,>
-- =============================================
CREATE PROCEDURE [dbo].[CalculateTransaction_OLD]
	-- Add the parameters for the stored procedure here
	@TrId bigint
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	--SET NOCOUNT ON;
		update PayedTransaction set Description = N'در حال محاسبه....' where id=@TrId

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
	  from DB_Mostamary.dbo.ContinusPayment as P where ContinusPaymentSupplyLocationId in (
	  1,2,3,4,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,38
	  )
	--  where P.baccountvalidated=1

	delete it.dbo.tbl_PayedContinusPayment_ReceiverNID where TransactionId=@TrId

	Insert into it.dbo.tbl_PayedContinusPayment_ReceiverNID
	( Id, PersonId, FamilyCount, SupplyLocationId, BankId, AccountNumber, Money, TransactionId, Date, CenterRegistrarId, ContinusPaymentId, EndDate, AcceptorUserId, IsActive, RegistrationReasonId, IntroducerId, ReceiverNID, 
                         ReceiverTitle, StartDate, RegistrarUserId, RegistrationDate)
		SELECT     PayedContinusPayment.Id, PayedContinusPayment.PersonId, PayedContinusPayment.FamilyCount, PayedContinusPayment.SupplyLocationId, PayedContinusPayment.BankId, PayedContinusPayment.AccountNumber, 
                         PayedContinusPayment.Money, PayedContinusPayment.TransactionId, PayedContinusPayment.Date, PayedContinusPayment.CenterRegistrarId, ContinusPayment.ContinusPaymentId, ContinusPayment.EndDate, 
                         ContinusPayment.AcceptorUserId, ContinusPayment.IsActive, ContinusPayment.RegistrationReasonId, ContinusPayment.IntroducerId, ContinusPayment.ReceiverNID, 
                         ContinusPayment.ReceiverTitle, ContinusPayment.StartDate, ContinusPayment.RegistrarUserId, ContinusPayment.RegistrationDate
						 FROM            PayedContinusPayment INNER JOIN
						 ContinusPayment ON PayedContinusPayment.PersonId = ContinusPayment.PersonId
						 WHERE        (PayedContinusPayment.TransactionId =  @TrId)  and  ContinusPaymentSupplyLocationId in (
	  1,2,3,4,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,38
	  )


	declare @cnt  bigint = (select count(*) from PayedContinusPayment where TransactionId=@TrId)
	update PayedTransaction set Description = N'تعداد رکورد های محاسبه شده ='+ str(@cnt) + ', تاریخ محاسبه '+Convert(nvarchar(100), GetDate())  where id=@TrId
END



