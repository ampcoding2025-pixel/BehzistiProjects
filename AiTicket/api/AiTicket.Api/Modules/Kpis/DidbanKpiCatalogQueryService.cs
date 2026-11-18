using AiTicket.Api.Contracts;
using AiTicket.Api.Infrastructure.Analytics;
using AiTicket.Api.Infrastructure.Didban;
using AiTicket.Api.Modules.Analytics;
using Dapper;
using Microsoft.Extensions.Options;

namespace AiTicket.Api.Modules.Kpis;

public interface IKpiCatalogQueryService
{
    Task<KpiCatalogResponse> GetCatalogAsync(PeriodFilter filter, CancellationToken ct);
    Task<KpiDrillResponse> GetDrillAsync(
        string code,
        string dimension,
        PeriodFilter filter,
        string? parentDimension,
        string? parentKey,
        CancellationToken ct);
}

/// <summary>
/// Relation-first KPI catalog (docs/17) with live Didban measurements.
/// Empty/unused sources return Value=null and EmptyBlocker text.
/// </summary>
public sealed partial class DidbanKpiCatalogQueryService(
    IDidbanConnectionFactory connectionFactory,
    IOptions<AnalyticsOptions> analyticsOptions,
    ILogger<DidbanKpiCatalogQueryService> logger) : IKpiCatalogQueryService
{
    private readonly AnalyticsOptions _analytics = analyticsOptions.Value;

    public async Task<KpiCatalogResponse> GetCatalogAsync(PeriodFilter filter, CancellationToken ct)
    {
        await using var connection = await connectionFactory.OpenReadOnlyAsync(ct);
        var (whereSql, parameters) = SqlFilterBuilder.BuildCookieWhere(filter, _analytics.DefaultCookieTypeId);
        var dp = ToDynamic(parameters);

        var core = await connection.QuerySingleAsync<CoreMetricsRow>(
            new CommandDefinition(
                $"""
                SELECT
                  COUNT_BIG(*) AS TotalCases,
                  SUM(CASE WHEN c.SubjectClassId = 1 THEN 1 ELSE 0 END) AS Complaints,
                  SUM(CASE WHEN c.SubjectClassId <> 1 THEN 1 ELSE 0 END) AS NonComplaints,
                  SUM(CASE WHEN c.CookieFinishTime IS NOT NULL THEN 1 ELSE 0 END) AS Finished,
                  SUM(CASE WHEN c.CookieFinishTime IS NULL THEN 1 ELSE 0 END) AS Unfinished,
                  AVG(CASE WHEN c.CookieFinishTime IS NOT NULL
                           THEN CAST(DATEDIFF(day, c.CookieTime, c.CookieFinishTime) AS float) END) AS AvgResolutionDays,
                  SUM(CASE WHEN ISNULL(c.CookieIsCritical, 0) = 1 THEN 1 ELSE 0 END) AS CriticalCases,
                  SUM(CASE WHEN c.ReferringCookieId IS NOT NULL THEN 1 ELSE 0 END) AS ReferringCases,
                  SUM(CASE WHEN c.AgentId IS NOT NULL THEN 1 ELSE 0 END) AS WithAgent,
                  SUM(CASE WHEN ISNULL(c.CookiePersuitsCount, 0) > 0 THEN 1 ELSE 0 END) AS WithPursuits,
                  AVG(CASE WHEN ISNULL(c.CookiePersuitsCount, 0) > 0
                           THEN CAST(c.CookiePersuitsCount AS float) END) AS AvgPursuits,
                  SUM(CASE WHEN c.CookieCancelTime IS NOT NULL THEN 1 ELSE 0 END) AS Cancelled,
                  SUM(CASE WHEN c.CookieDeadlineTime IS NOT NULL THEN 1 ELSE 0 END) AS WithDeadline,
                  SUM(CASE WHEN c.CookieCauseId IS NOT NULL THEN 1 ELSE 0 END) AS WithCause,
                  SUM(CASE WHEN c.GiftId IS NOT NULL THEN 1 ELSE 0 END) AS WithGift,
                  COUNT(DISTINCT c.SubjectId) AS DistinctSubjects,
                  COUNT(DISTINCT c.SubjectGroupId) AS DistinctGroups,
                  COUNT(DISTINCT c.SubjectNatureId) AS DistinctNatures,
                  COUNT(DISTINCT c.ZoneId) AS DistinctZones,
                  COUNT(DISTINCT c.DepartmentId) AS DistinctDepartments,
                  COUNT(DISTINCT c.CookieChannelId) AS DistinctChannels,
                  COUNT(DISTINCT c.SubjectPriorityId) AS DistinctPriorities,
                  SUM(CASE WHEN c.CookieStatusId = 40 THEN 1 ELSE 0 END) AS StatusRedistributed,
                  SUM(CASE WHEN c.CookieStatusId = 31 THEN 1 ELSE 0 END) AS StatusReferred
                FROM dbo.Cookie c
                {whereSql}
                """,
                dp,
                cancellationToken: ct));

        var flow = await connection.QuerySingleAsync<FlowMetricsRow>(
            new CommandDefinition(
                $"""
                SELECT
                  COUNT_BIG(*) AS FlowRows,
                  COUNT(DISTINCT f.CookieId) AS CookiesWithFlow,
                  COUNT(DISTINCT CASE WHEN f.CookieFlowReplyCitizen IS NOT NULL
                            AND LEN(LTRIM(RTRIM(f.CookieFlowReplyCitizen))) > 0
                       THEN f.CookieId END) AS CookiesWithReply,
                  SUM(CASE WHEN ISNULL(f.CookieFlowDelayTime, 0) > 0 THEN 1 ELSE 0 END) AS DelayRows,
                  SUM(CASE WHEN ISNULL(f.CookieFlowDiscontentCount, 0) > 0 THEN 1 ELSE 0 END) AS DiscontentRows,
                  SUM(CASE WHEN f.ReferToUserId IS NOT NULL THEN 1 ELSE 0 END) AS ReferToUserFilled
                FROM dbo.Cookie c
                INNER JOIN dbo.CookieFlow f ON f.CookieId = c.CookieId
                {whereSql}
                """,
                dp,
                cancellationToken: ct));

        var cartableOpen = await connection.ExecuteScalarAsync<long>(
            new CommandDefinition("SELECT COUNT_BIG(*) FROM dbo.Cartable", cancellationToken: ct));

        var stepsFirst = await connection.QuerySingleAsync<StepsFirstRow>(
            new CommandDefinition(
                $"""
                SELECT
                  AVG(CAST(x.StepCount AS float)) AS AvgSteps,
                  AVG(CASE WHEN x.FirstFlow IS NOT NULL
                           THEN CAST(DATEDIFF(hour, x.CookieTime, x.FirstFlow) AS float) END) AS AvgFirstHours
                FROM (
                  SELECT
                    c.CookieId,
                    c.CookieTime,
                    COUNT_BIG(f.CookieFlowId) AS StepCount,
                    MIN(f.CookieFlowTime) AS FirstFlow
                  FROM dbo.Cookie c
                  LEFT JOIN dbo.CookieFlow f ON f.CookieId = c.CookieId
                  {whereSql}
                  GROUP BY c.CookieId, c.CookieTime
                ) x
                """,
                dp,
                cancellationToken: ct));
        var inform = await connection.QuerySingleAsync<InformMetricsRow>(
            new CommandDefinition(
                $"""
                SELECT
                  COUNT(DISTINCT i.RegionId) AS DistinctRegions,
                  SUM(CASE WHEN i.AreaId IS NOT NULL THEN 1 ELSE 0 END) AS WithArea,
                  SUM(CASE WHEN i.DistrinctId IS NOT NULL THEN 1 ELSE 0 END) AS WithDistrict,
                  SUM(CASE WHEN i.SegmentId IS NOT NULL THEN 1 ELSE 0 END) AS WithSegment
                FROM dbo.Cookie c
                INNER JOIN dbo.Inform i ON i.CookieId = c.CookieId
                {whereSql}
                """,
                dp,
                cancellationToken: ct));

        var classMix = (await connection.QueryAsync<NamedValueDto>(
            new CommandDefinition(
                $"""
                SELECT sc.SubjectClassName AS Name, COUNT_BIG(*) AS Value
                FROM dbo.Cookie c
                INNER JOIN dbo.SubjectClass sc ON sc.SubjectClassId = c.SubjectClassId
                {whereSql}
                GROUP BY sc.SubjectClassName
                ORDER BY Value DESC
                """,
                dp,
                cancellationToken: ct))).ToList();

        var topChannels = (await connection.QueryAsync<NamedValueDto>(
            new CommandDefinition(
                $"""
                SELECT TOP 12 ch.CookieChannelName AS Name, COUNT_BIG(*) AS Value
                FROM dbo.Cookie c
                INNER JOIN dbo.CookieChannel ch ON ch.CookieChannelId = c.CookieChannelId
                {whereSql}
                GROUP BY ch.CookieChannelName
                ORDER BY Value DESC
                """,
                dp,
                cancellationToken: ct))).ToList();

        var topRegions = (await connection.QueryAsync<NamedValueDto>(
            new CommandDefinition(
                $"""
                SELECT TOP 12 r.RegionName AS Name, COUNT_BIG(*) AS Value
                FROM dbo.Cookie c
                INNER JOIN dbo.Inform i ON i.CookieId = c.CookieId
                INNER JOIN dbo.Region r ON r.RegionId = i.RegionId
                {whereSql}
                GROUP BY r.RegionName
                ORDER BY Value DESC
                """,
                dp,
                cancellationToken: ct))).ToList();

        var topDepartments = (await connection.QueryAsync<NamedValueDto>(
            new CommandDefinition(
                $"""
                SELECT TOP 12 d.DepartmentName AS Name, COUNT_BIG(*) AS Value
                FROM dbo.Cookie c
                INNER JOIN dbo.Department d ON d.DepartmentId = c.DepartmentId
                {whereSql}
                GROUP BY d.DepartmentName
                ORDER BY Value DESC
                """,
                dp,
                cancellationToken: ct))).ToList();

        var priorityMix = (await connection.QueryAsync<NamedValueDto>(
            new CommandDefinition(
                $"""
                SELECT TOP 12 ISNULL(sp.SubjectPriorityName, N'(بدون نام)') AS Name, COUNT_BIG(*) AS Value
                FROM dbo.Cookie c
                LEFT JOIN dbo.SubjectPriority sp ON sp.SubjectPriorityId = c.SubjectPriorityId
                {whereSql}
                GROUP BY sp.SubjectPriorityName
                ORDER BY Value DESC
                """,
                dp,
                cancellationToken: ct))).ToList();

        var topSubjects = (await connection.QueryAsync<NamedValueDto>(
            new CommandDefinition(
                $"""
                SELECT TOP 12 s.SubjectName AS Name, COUNT_BIG(*) AS Value
                FROM dbo.Cookie c
                INNER JOIN dbo.Subject s ON s.SubjectId = c.SubjectId
                {whereSql}
                GROUP BY s.SubjectName
                ORDER BY Value DESC
                """,
                dp,
                cancellationToken: ct))).ToList();

        var monthly = (await connection.QueryAsync<MonthlyTrendRow>(
            new CommandDefinition(
                $"""
                SELECT
                  CONCAT(
                    CAST(YEAR(c.CookieTime) AS nvarchar(4)),
                    N'/',
                    RIGHT(CONCAT(N'0', CAST(MONTH(c.CookieTime) AS nvarchar(2))), 2)
                  ) AS Label,
                  COUNT_BIG(*) AS Total,
                  SUM(CASE WHEN c.SubjectClassId = 1 THEN 1 ELSE 0 END) AS Complaints,
                  SUM(CASE WHEN c.CookieFinishTime IS NOT NULL THEN 1 ELSE 0 END) AS Finished,
                  SUM(CASE WHEN c.CookieFinishTime IS NULL THEN 1 ELSE 0 END) AS Unfinished,
                  SUM(CASE WHEN ISNULL(c.CookiePersuitsCount, 0) > 0 THEN 1 ELSE 0 END) AS WithPursuits,
                  SUM(CASE WHEN c.AgentId IS NOT NULL THEN 1 ELSE 0 END) AS WithAgent,
                  SUM(CASE WHEN c.CookieStatusId = 40 THEN 1 ELSE 0 END) AS Redistributed,
                  SUM(CASE WHEN c.CookieStatusId = 31 THEN 1 ELSE 0 END) AS Referred,
                  SUM(CASE WHEN ISNULL(c.CookieIsCritical, 0) = 1 THEN 1 ELSE 0 END) AS Critical,
                  SUM(CASE WHEN c.ReferringCookieId IS NOT NULL THEN 1 ELSE 0 END) AS Referring,
                  AVG(CASE WHEN c.CookieFinishTime IS NOT NULL
                           THEN CAST(DATEDIFF(day, c.CookieTime, c.CookieFinishTime) AS float) END) AS AvgDays
                FROM dbo.Cookie c
                {whereSql}
                GROUP BY YEAR(c.CookieTime), MONTH(c.CookieTime)
                ORDER BY YEAR(c.CookieTime), MONTH(c.CookieTime)
                """,
                dp,
                cancellationToken: ct))).ToList();

        var monthlyReply = (await connection.QueryAsync<MonthlyReplyRow>(
            new CommandDefinition(
                $"""
                SELECT
                  CONCAT(
                    CAST(YEAR(c.CookieTime) AS nvarchar(4)),
                    N'/',
                    RIGHT(CONCAT(N'0', CAST(MONTH(c.CookieTime) AS nvarchar(2))), 2)
                  ) AS Label,
                  COUNT_BIG(*) AS Total,
                  COUNT_BIG(replied.CookieId) AS WithReply
                FROM dbo.Cookie c
                LEFT JOIN (
                  SELECT DISTINCT f.CookieId
                  FROM dbo.CookieFlow f
                  WHERE f.CookieFlowReplyCitizen IS NOT NULL
                    AND LEN(LTRIM(RTRIM(f.CookieFlowReplyCitizen))) > 0
                ) replied ON replied.CookieId = c.CookieId
                {whereSql}
                GROUP BY YEAR(c.CookieTime), MONTH(c.CookieTime)
                ORDER BY YEAR(c.CookieTime), MONTH(c.CookieTime)
                """,
                dp,
                cancellationToken: ct))).ToList();
        var satellite = await connection.QuerySingleAsync<SatelliteRow>(
            new CommandDefinition(
                """
                SELECT
                  (SELECT COUNT_BIG(*) FROM dbo.Sentbox) AS SentboxRows,
                  (SELECT COUNT_BIG(*) FROM dbo.Inbox) AS InboxRows,
                  (SELECT COUNT_BIG(*) FROM dbo.CallReceived) AS CallReceivedRows,
                  (SELECT COUNT_BIG(*) FROM dbo.CallRecord) AS CallRecordRows,
                  (SELECT COUNT_BIG(*) FROM dbo.CallRecord WHERE CookieId IS NOT NULL) AS CallRecordLinked,
                  (SELECT COUNT_BIG(*) FROM dbo.AttachmentVisite) AS AttachmentVisits,
                  (SELECT COUNT_BIG(*) FROM dbo.CookiePursuit) AS PursuitRows,
                  (SELECT COUNT_BIG(*) FROM dbo.CookiePursuit
                     WHERE CookiePursuitReply IS NOT NULL
                       AND LEN(LTRIM(RTRIM(CookiePursuitReply))) > 0) AS PursuitReplies,
                  (SELECT COUNT_BIG(*) FROM dbo.FAQ) AS FaqRows,
                  (SELECT COUNT_BIG(*) FROM dbo.Gift) AS GiftRows,
                  (SELECT COUNT_BIG(*) FROM dbo.Personnel) AS PersonnelRows,
                  (SELECT COUNT_BIG(*) FROM dbo.Mission) AS MissionRows,
                  (SELECT COUNT_BIG(*) FROM dbo.CheckList) AS CheckListRows,
                  (SELECT COUNT_BIG(*) FROM dbo.ChatRoom) AS ChatRoomRows,
                  (SELECT COUNT_BIG(*) FROM dbo.Referal) AS ReferalRows,
                  (SELECT COUNT_BIG(*) FROM dbo.Reminder) AS ReminderRows,
                  (SELECT COUNT_BIG(*) FROM dbo.Dictionary) AS DictionaryRows,
                  (SELECT COUNT_BIG(*) FROM dbo.District) AS DistrictRows,
                  (SELECT COUNT_BIG(*) FROM dbo.Segment) AS SegmentRows,
                  (SELECT COUNT_BIG(*) FROM dbo.CookieFieldType) AS FieldTypeRows,
                  (SELECT COUNT_BIG(*) FROM dbo.PursuitTemplate) AS PursuitTemplateRows,
                  (SELECT COUNT_BIG(*) FROM dbo.RoleMemberAccess) AS RoleMemberAccessRows,
                  (SELECT COUNT_BIG(*) FROM dbo.DepartmentChart) AS DepartmentChartRows,
                  (SELECT COUNT_BIG(*) FROM dbo.TrackUsers) AS TrackUsersRows,
                  (SELECT COUNT_BIG(*) FROM dbo.HttpLog) AS HttpLogRows,
                  (SELECT COUNT_BIG(*) FROM dbo.LoginLog) AS LoginLogRows,
                  (SELECT COUNT_BIG(*) FROM dbo.CookieLog) AS CookieLogRows
                """,
                cancellationToken: ct));

        var total = core.TotalCases;
        var items = BuildItems(
            core, flow, stepsFirst, inform, cartableOpen, satellite,
            classMix, topChannels, topRegions, topDepartments, priorityMix, topSubjects, total);
        items = EnrichCharts(items, monthly, monthlyReply, classMix, topChannels, topRegions, topDepartments, priorityMix, topSubjects, core, satellite);

        var counts = new KpiCatalogCountsDto(
            items.Count(i => i.Feasibility == "feasible"),
            items.Count(i => i.Feasibility == "needs_rules"),
            items.Count(i => i.Feasibility == "weak_proxy"),
            items.Count(i => i.Feasibility == "empty"),
            items.Count(i => i.Feasibility == "audit"));

        logger.LogInformation(
            "KPI catalog computed. Items={Count} TotalCases={Total} RuleSet={RuleSet}",
            items.Count, total, _analytics.RuleSetVersion);

        return new KpiCatalogResponse(
            new MetaDto(
                "didban",
                DateTimeOffset.UtcNow,
                SqlFilterBuilder.PeriodLabel(filter),
                ["Relation-first catalog from docs/17; empty sources marked Can't calculate."]),
            _analytics.RuleSetVersion,
            counts,
            items);
    }

    private static List<KpiCatalogItemDto> BuildItems(
        CoreMetricsRow core,
        FlowMetricsRow flow,
        StepsFirstRow stepsFirst,
        InformMetricsRow inform,
        long cartableOpen,
        SatelliteRow sat,
        List<NamedValueDto> classMix,
        List<NamedValueDto> topChannels,
        List<NamedValueDto> topRegions,
        List<NamedValueDto> topDepartments,
        List<NamedValueDto> priorityMix,
        List<NamedValueDto> topSubjects,
        long total)
    {
        _ = topSubjects;
        double Pct(long n, long d) => d == 0 ? 0 : Math.Round(100.0 * n / d, 1);
        double? Round(double? v, int digits = 1) => v is null ? null : Math.Round(v.Value, digits);

        var complaintRate = Pct(core.Complaints, total);
        var finishRate = Pct(core.Finished, total);
        var replyRate = Pct(flow.CookiesWithReply, total);
        var pursuitRate = Pct(core.WithPursuits, total);
        var criticalRate = Pct(core.CriticalCases, total);
        var referringRate = Pct(core.ReferringCases, total);
        var agentShare = Pct(core.WithAgent, total);
        var delayRate = flow.FlowRows == 0 ? 0 : Pct(flow.DelayRows, flow.FlowRows);
        var discontentRate = flow.FlowRows == 0 ? 0 : Pct(flow.DiscontentRows, flow.FlowRows);
        var redistribRate = Pct(core.StatusRedistributed, total);
        var referStatusRate = Pct(core.StatusReferred, total);
        var callLinkRate = sat.CallRecordRows == 0 ? 0 : Pct(sat.CallRecordLinked, sat.CallRecordRows);
        var smsInboxRatio = sat.SentboxRows == 0 ? 0 : Math.Round(100.0 * sat.InboxRows / sat.SentboxRows, 1);
        var attachPerCase = total == 0 ? 0 : Math.Round((double)sat.AttachmentVisits / total, 2);

        var list = new List<KpiCatalogItemDto>
        {
            Item("V1", 1, "tier1", "G1", "کل پرونده‌ها", "تعداد Cookie در بازه", "COUNT(Cookie)", "Cookie",
                "feasible", total, "count"),
            Item("V2", 2, "tier1", "G1", "تعداد شکایت", "SubjectClass = شکایت", "COUNT WHERE SubjectClassId=1", "Cookie+SubjectClass",
                "feasible", core.Complaints, "count", note: $"سهم شکایت ≈ {complaintRate}٪"),
            Item("R1", 3, "tier1", "G2", "نرخ اتمام (FinishTime)", "سهم پرونده‌های دارای CookieFinishTime", "Finished/Total×100", "Cookie",
                "needs_rules", finishRate, "percent", note: "تعریف رسمی «بسته» هنوز امضا نشده"),
            Item("R2", 4, "tier1", "G2", "میانگین روز تا اتمام", "Finish − CookieTime", "AVG(DATEDIFF day)", "Cookie",
                "needs_rules", Round(core.AvgResolutionDays), "days"),
            Item("R3", 5, "tier1", "G2", "اندازه backlog", "بدون FinishTime + کارتابل باز", "Unfinished + COUNT(Cartable)", "Cookie+Cartable",
                "needs_rules", core.Unfinished, "count", note: $"Cartable باز ≈ {cartableOpen:N0}"),
            Item("V4", 6, "tier1", "G1", "تنوع تاکسونومی", "تعداد موضوعات/گروه/ماهیت/پهنه فعال", "COUNT DISTINCT Subject*", "Cookie+Subject*",
                "feasible", core.DistinctSubjects, "count",
                note: $"گروه={core.DistinctGroups} · ماهیت={core.DistinctNatures} · پهنه={core.DistinctZones}",
                breakdown:
                [
                    new("موضوع", core.DistinctSubjects),
                    new("گروه", core.DistinctGroups),
                    new("ماهیت", core.DistinctNatures),
                    new("پهنه", core.DistinctZones)
                ]),
            Item("V5", 7, "tier1", "G1", "حجم بر اساس واحد سازمانی", "توزیع Department", "COUNT by DepartmentId", "Cookie+Department",
                "feasible", core.DistinctDepartments, "count", breakdown: topDepartments,
                note: "مقدار = تعداد واحدهای دارای پرونده؛ جدول = ۵ واحد پرتکرار"),
            Item("V7", 8, "tier1", "G1", "حجم بر اساس استان", "توزیع Region از Inform", "COUNT by RegionId", "Inform+Region",
                "feasible", inform.DistinctRegions, "count", breakdown: topRegions),
            Item("R5", 9, "tier1", "G2", "ورودی در برابر اتمام", "تعداد ورودی دوره و تعداد دارای Finish", "Opened vs Finished", "Cookie",
                "feasible", total, "count", note: $"ورودی={total:N0} · اتمام‌دار={core.Finished:N0}",
                breakdown: [new("ورودی", total), new("اتمام‌دار", core.Finished), new("بدون اتمام", core.Unfinished)]),
            Item("V8", 10, "tier1", "G1", "روند زمانی", "حجم بر اساس CookieTime", "COUNT by period", "Cookie",
                "feasible", total, "count", note: "روند ماهانه در داشبورد مدیریتی موجود است"),

            Item("R12", 11, "tier2", "G2", "میانگین ساعت تا اولین جریان", "اولین CookieFlow پس از ثبت", "AVG hours to first flow", "Cookie+CookieFlow",
                "needs_rules", Round(stepsFirst.AvgFirstHours), "days",
                note: "واحد خام ساعت است؛ برای نمایش روز÷۲۴ تقریبی نیست — مقدار بر حسب ساعت/۲۴ به روز"),
            Item("A1", 12, "tier2", "G4", "پوشش پاسخ شهروندی", "% پرونده با CookieFlowReplyCitizen", "CookiesWithReply/Total×100", "CookieFlow",
                "feasible", replyRate, "percent", note: $"≈ {flow.CookiesWithReply:N0} پرونده"),
            Item("P1", 13, "tier2", "G3", "نرخ پیگیری", "% پرونده با Pursuit>0", "Pursued/Total×100", "Cookie+CookiePursuit",
                "feasible", pursuitRate, "percent"),
            Item("P2", 14, "tier2", "G3", "میانگین پیگیری (پرونده‌های پیگیری‌شده)", "Avg CookiePersuitsCount where >0", "AVG pursuits", "Cookie",
                "feasible", Round(core.AvgPursuits, 2), "ratio"),
            Item("R7", 15, "tier2", "G2", "نرخ توزیع مجدد (وضعیت ۴۰)", "سهم وضعیت توزیع مجدد", "Status40/Total×100", "Cookie+CookieStatus",
                "needs_rules", redistribRate, "percent"),
            Item("V6", 16, "tier2", "G1", "ترکیب کانال", "توزیع CookieChannel", "COUNT by Channel", "CookieChannel",
                "feasible", core.DistinctChannels, "count", breakdown: topChannels),
            Item("R13", 17, "tier2", "G2", "میانگین گام‌های جریان", "Avg CookieFlow rows per Cookie", "AVG steps", "CookieFlow",
                "feasible", Round(stepsFirst.AvgSteps, 2), "ratio"),
            Item("R10", 18, "tier2", "G2", "سهم جریان‌های دارای تأخیر", "% Flow با DelayTime>0", "DelayRows/FlowRows×100", "CookieFlow",
                "weak_proxy", delayRate, "percent", note: "معنای تجاری DelayTime تأیید نشده"),
            Item("R11", 19, "tier2", "G2", "سهم جریان‌های نارضایتی", "% Flow با DiscontentCount>0", "Discontent/Flow×100", "CookieFlow",
                "weak_proxy", discontentRate, "percent"),
            Item("V3", 20, "tier2", "G1", "ترکیب طبقات غیرشکایت/شکایت", "SubjectClass mix", "COUNT by SubjectClass", "SubjectClass",
                "feasible", core.NonComplaints, "count", breakdown: classMix),

            Item("V10", 21, "tier2", "G1", "ترکیب اولویت", "SubjectPriority mix", "COUNT by Priority", "SubjectPriority",
                "feasible", core.DistinctPriorities, "count", breakdown: priorityMix),
            Item("T1", 22, "tier3", "G5", "حجم تماس ورودی", "COUNT CallReceived", "COUNT(*)", "CallReceived",
                "feasible", sat.CallReceivedRows, "count"),
            Item("T2", 23, "tier3", "G5", "تماس‌های متصل به پرونده", "CallRecord با CookieId", "COUNT linked", "CallRecord",
                "feasible", sat.CallRecordLinked, "count", note: $"از {sat.CallRecordRows:N0} رکورد · پیوند≈{callLinkRate}٪"),
            Item("T3", 24, "tier3", "G5", "نسبت تماس→پرونده", "CallRecord linked / CallReceived", "Linked/Received×100", "CallReceived+CallRecord",
                "needs_rules", sat.CallReceivedRows == 0 ? 0 : Pct(sat.CallRecordLinked, sat.CallReceivedRows), "percent",
                breakdown: [new("تماس ورودی", sat.CallReceivedRows), new("متصل به پرونده", sat.CallRecordLinked)]),
            Item("A3", 25, "tier3", "G4", "حجم پیامک خروجی", "COUNT Sentbox", "COUNT(*)", "Sentbox",
                "feasible", sat.SentboxRows, "count",
                breakdown: [new("Sentbox", sat.SentboxRows), new("Inbox", sat.InboxRows)]),
            Item("O1", 26, "tier3", "G6", "بار کاری واحد (نمونه ۵تایی)", "Top departments by volume", "COUNT by Dept", "Cookie+Department",
                "feasible", core.DistinctDepartments, "count", breakdown: topDepartments),
            Item("O5", 27, "tier3", "G6", "سهم پرونده با Agent", "% Cookie.AgentId پر", "WithAgent/Total×100", "Cookie+Agent",
                "feasible", agentShare, "percent"),
            Item("E1", 28, "tier3", "G7", "بازدید پیوست به ازای پرونده", "AttachmentVisite / Cookie", "Visits/Total", "AttachmentVisite",
                "feasible", attachPerCase, "ratio", note: $"کل بازدید={sat.AttachmentVisits:N0}"),
            Item("A4", 29, "tier3", "G4", "نسبت Inbox به Sentbox", "Inbox/Sentbox×100", "proxy delivery", "Inbox+Sentbox",
                "weak_proxy", smsInboxRatio, "percent",
                breakdown: [new("Sentbox", sat.SentboxRows), new("Inbox", sat.InboxRows)]),
            Item("V11", 30, "tier3", "G1", "پرونده‌های ارجاع‌شده/مرتبط", "ReferringCookieId پر", "COUNT referring", "Cookie",
                "weak_proxy", core.ReferringCases, "count", note: $"نرخ≈{referringRate}٪"),
            Item("O4", 31, "tier3", "G6", "رکوردهای دسترسی نقش/کانال", "COUNT RoleMemberAccess", "COUNT(*)", "RoleMemberAccess",
                "feasible", sat.RoleMemberAccessRows, "count"),
            Item("O3", 32, "tier3", "G6", "گره‌های چارت سازمانی", "COUNT DepartmentChart", "COUNT(*)", "DepartmentChart",
                "feasible", sat.DepartmentChartRows, "count"),
            Item("R4", 33, "tier3", "G2", "کارتابل باز (فعلی)", "COUNT Cartable", "COUNT(*)", "Cartable",
                "needs_rules", cartableOpen, "count"),
            Item("R8", 34, "tier3", "G2", "نرخ وضعیت ارجاع (۳۱)", "Status 31 share", "Status31/Total×100", "CookieStatus",
                "weak_proxy", referStatusRate, "percent",
                note: flow.ReferToUserFilled == 0
                    ? "ReferToUserId روی Flow خالی است؛ فقط وضعیت ۳۱ به‌عنوان پروکسی"
                    : null),
            Item("R14", 35, "tier3", "G2", "اتمام در برابر کارتابل", "Finished vs Cartable snapshot", "Finished & Cartable", "Cookie+Cartable",
                "needs_rules", core.Finished, "count", note: $"اتمام‌دار={core.Finished:N0} · کارتابل={cartableOpen:N0}"),
            Item("V9", 36, "tier4", "G1", "نرخ پرونده بحرانی", "CookieIsCritical=1", "Critical/Total×100", "Cookie",
                "weak_proxy", criticalRate, "percent", note: $"فقط {core.CriticalCases:N0} مورد"),
            Item("V17", 37, "tier3", "G1", "تعداد پرونده با Agent", "AgentId IS NOT NULL", "COUNT", "Cookie+Agent",
                "feasible", core.WithAgent, "count"),
            Item("T4", 38, "tier3", "G5", "تماس‌های ثبت‌شده روی جریان/پیگیری", "CallRecord rows", "COUNT CallRecord", "CallRecord",
                "feasible", sat.CallRecordRows, "count"),

            // Audit
            Item("L1", 39, "tier4", "G8", "حجم HttpLog", "تله‌متری سیستم", "COUNT HttpLog", "HttpLog",
                "audit", sat.HttpLogRows, "count"),
            Item("L2", 40, "tier4", "G8", "حجم LoginLog", "ممیزی ورود", "COUNT LoginLog", "LoginLog",
                "audit", sat.LoginLogRows, "count"),
            Item("L3", 41, "tier4", "G8", "حجم CookieLog", "ممیزی تغییر پرونده", "COUNT CookieLog", "CookieLog",
                "audit", sat.CookieLogRows, "count"),
            Item("O8", 42, "tier4", "G6", "رویداد TrackUsers", "ردیابی اپراتور", "COUNT TrackUsers", "TrackUsers",
                "audit", sat.TrackUsersRows, "count"),

            // Empty / blocked
            Empty("R9", "tier5", "G2", "رعایت SLA واقعی", "مهلت در برابر اتمام", "*DeadlineTime", "Cookie/Flow/Cartable",
                "ستون‌های DeadlineTime خالی هستند (۰ پرشده)"),
            Empty("V12", "tier5", "G1", "نرخ لغو", "CookieCancelTime", "CancelTime filled", "Cookie",
                core.Cancelled == 0 ? "CookieCancelTime خالی است" : "تقریباً بدون داده لغو"),
            Empty("V13", "tier5", "G1", "ترکیب علت (Cause)", "CookieCause", "CauseId", "CookieCause",
                core.WithCause == 0 ? "CookieCauseId روی پرونده‌ها پر نشده" : "Cause practically unused"),
            Empty("V14", "tier5", "G9", "شاخص هدیه/تشویق", "Gift module", "GiftId", "Gift*",
                sat.GiftRows == 0 ? "جداول Gift خالی‌اند" : "Gift data insufficient"),
            Empty("V15", "tier5", "G1", "حجم منطقه/سگمنت", "District/Segment", "Inform.DistrinctId/SegmentId", "District+Segment",
                sat.DistrictRows == 0 && sat.SegmentRows == 0
                    ? "جداول District و Segment خالی‌اند"
                    : "فیلدهای District/Segment روی Inform خالی‌اند"),
            Empty("V16", "tier5", "G1", "تحلیل فیلد سفارشی", "CookieFieldType", "FieldTypeIds", "CookieFieldType",
                sat.FieldTypeRows == 0 ? "جدول CookieFieldType خالی است" : "Custom fields unused"),
            Empty("O6", "tier5", "G6", "بهره‌وری پرسنل/مجری", "Personnel/Executer", "PersonnelId", "Personnel",
                sat.PersonnelRows == 0 ? "جدول Personnel خالی است" : "Personnel unused"),
            Empty("O7", "tier5", "G6", "جمعیت‌شناسی Agent", "SocialClass/Grade/Expertise", "Agent* lookups", "Agent*",
                "جداول AgentSocialClass / Grade / Expertise خالی‌اند"),
            Empty("P3", "tier5", "G3", "پوشش پاسخ پیگیری", "Pursuit replies", "CookiePursuitReply", "CookiePursuit",
                sat.PursuitReplies == 0 ? "پاسخ‌های پیگیری خالی‌اند" : "Pursuit replies insufficient"),
            Empty("P4", "tier5", "G3", "پیگیری قالب‌محور", "PursuitTemplate", "COUNT templates", "PursuitTemplate",
                sat.PursuitTemplateRows == 0 ? "PursuitTemplate خالی است" : "templates unused"),
            Empty("A5", "tier5", "G4", "پوشش FAQ", "FAQ knowledge", "COUNT FAQ", "FAQ",
                sat.FaqRows <= 5 ? $"FAQ فقط {sat.FaqRows} ردیف دارد — قابل اتکا نیست" : null),
            Empty("A6", "tier5", "G4", "دانش Dictionary/مقررات", "Dictionary", "COUNT", "Dictionary",
                sat.DictionaryRows == 0 ? "جدول Dictionary خالی است" : null),
            Empty("E2", "tier5", "G7", "کامل بودن فایل پیوست", "Attachment files", "DidehbanAttachment", "Attachment DB",
                "دسترسی به دیتابیس پیوست برای این کاربر وجود ندارد"),
            Empty("X1", "tier5", "G9", "شاخص مأموریت میدانی", "Mission", "COUNT Mission", "Mission*",
                sat.MissionRows == 0 ? "جداول Mission خالی‌اند" : null),
            Empty("X2", "tier5", "G9", "رعایت چک‌لیست", "CheckList", "Chk*", "CheckList*",
                sat.CheckListRows == 0 ? "جداول CheckList خالی‌اند" : null),
            Empty("X3", "tier5", "G9", "شاخص چت خدمت‌گیرنده", "Chat", "ChatRoom/Message", "Chat*",
                sat.ChatRoomRows == 0 ? "جداول Chat خالی‌اند" : null),
            Empty("X4", "tier5", "G9", "چرخه ارجاع رسمی", "Referal", "COUNT", "Referal",
                sat.ReferalRows == 0 ? "جدول Referal خالی است" : null),
            Empty("X5", "tier5", "G9", "SLA یادآور", "Reminder", "COUNT", "Reminder",
                sat.ReminderRows == 0 ? "جدول Reminder خالی است" : null),
            Empty("X6", "tier5", "G9", "نرخ کامنت/اختلاف", "CookieComment*", "COUNT", "CookieComment*",
                "جداول CookieComment خالی‌اند"),
            Empty("X7", "tier5", "G9", "نرخ اشتراک پرونده", "CookieShare", "COUNT", "CookieShare",
                "جدول CookieShare خالی است"),
            Empty("X8", "tier5", "G9", "بهره‌برداری خودرو/تجهیزات", "Vehicle/Equip", "COUNT", "Vehicle*+Equip*",
                "جداول Vehicle/Equip خالی‌اند"),
            Empty("X9", "tier5", "G2", "امتیاز رضایت", "SatisfactionScore", "AVG score", "Cookie/Flow",
                "فیلدهای امتیاز رضایت قابل استفاده نیستند"),
            Empty("X10", "tier5", "G2", "ارجاع به کاربر (ReferToUser)", "ReferToUserId", "COUNT filled", "CookieFlow/Cartable",
                flow.ReferToUserFilled == 0 ? "ReferToUserId هرگز پر نشده" : null),
        };

        // Fix R12 unit: store hours but label as hours via note; convert to days for unit=days
        var r12 = list.FindIndex(i => i.Id == "R12");
        if (r12 >= 0 && stepsFirst.AvgFirstHours is not null)
        {
            list[r12] = list[r12] with
            {
                Value = Math.Round(stepsFirst.AvgFirstHours.Value / 24.0, 2),
                Unit = "days",
                Note = $"میانگین ≈ {stepsFirst.AvgFirstHours.Value:0.#} ساعت تا اولین CookieFlow"
            };
        }

        return list;
    }

    private static KpiCatalogItemDto Item(
        string id,
        int rank,
        string tier,
        string group,
        string name,
        string definition,
        string formula,
        string tables,
        string feasibility,
        double? value,
        string unit,
        string? emptyBlocker = null,
        string? note = null,
        IReadOnlyList<NamedValueDto>? breakdown = null) =>
        new(id, rank, tier, group, name, definition, formula, tables, feasibility, value, unit, emptyBlocker, note,
            breakdown, "none", null, Array.Empty<string>());

    private static KpiCatalogItemDto Empty(
        string id,
        string tier,
        string group,
        string name,
        string definition,
        string formula,
        string tables,
        string? blocker) =>
        new(id, null, tier, group, name, definition, formula, tables, "empty", null, "count",
            blocker ?? "منبع داده خالی است", "Can't calculate (empty)", null, "none", null, Array.Empty<string>());

    private static List<KpiCatalogItemDto> EnrichCharts(
        List<KpiCatalogItemDto> items,
        List<MonthlyTrendRow> monthly,
        List<MonthlyReplyRow> monthlyReply,
        List<NamedValueDto> classMix,
        List<NamedValueDto> topChannels,
        List<NamedValueDto> topRegions,
        List<NamedValueDto> topDepartments,
        List<NamedValueDto> priorityMix,
        List<NamedValueDto> topSubjects,
        CoreMetricsRow core,
        SatelliteRow sat)
    {
        static List<KpiSeriesPointDto> SeriesFrom(IEnumerable<(string Label, double Value)> rows) =>
            rows.Select(r => new KpiSeriesPointDto(r.Label, Math.Round(r.Value, 2))).ToList();

        var totalSeries = SeriesFrom(monthly.Select(m => (m.Label ?? "", (double)m.Total)));
        var complaintSeries = SeriesFrom(monthly.Select(m => (m.Label ?? "", (double)m.Complaints)));
        var unfinishedSeries = SeriesFrom(monthly.Select(m => (m.Label ?? "", (double)m.Unfinished)));
        var finishRateSeries = SeriesFrom(monthly.Select(m =>
            (m.Label ?? "", m.Total == 0 ? 0 : 100.0 * m.Finished / m.Total)));
        var avgDaysSeries = SeriesFrom(monthly.Where(m => m.AvgDays is not null)
            .Select(m => (m.Label ?? "", m.AvgDays!.Value)));
        var pursuitRateSeries = SeriesFrom(monthly.Select(m =>
            (m.Label ?? "", m.Total == 0 ? 0 : 100.0 * m.WithPursuits / m.Total)));
        var agentRateSeries = SeriesFrom(monthly.Select(m =>
            (m.Label ?? "", m.Total == 0 ? 0 : 100.0 * m.WithAgent / m.Total)));
        var redistribSeries = SeriesFrom(monthly.Select(m =>
            (m.Label ?? "", m.Total == 0 ? 0 : 100.0 * m.Redistributed / m.Total)));
        var referredSeries = SeriesFrom(monthly.Select(m =>
            (m.Label ?? "", m.Total == 0 ? 0 : 100.0 * m.Referred / m.Total)));
        var criticalSeries = SeriesFrom(monthly.Select(m => (m.Label ?? "", (double)m.Critical)));
        var referringSeries = SeriesFrom(monthly.Select(m => (m.Label ?? "", (double)m.Referring)));
        var replyRateSeries = SeriesFrom(monthlyReply.Select(m =>
            (m.Label ?? "", m.Total == 0 ? 0 : 100.0 * m.WithReply / m.Total)));
        var finishedSeries = SeriesFrom(monthly.Select(m => (m.Label ?? "", (double)m.Finished)));

        string[] cookieDims = ["department", "region", "channel", "subjectClass", "subject"];
        string[] mixDims = ["department", "region", "channel"];

        var map = new Dictionary<string, (string Chart, IReadOnlyList<KpiSeriesPointDto>? Series, IReadOnlyList<NamedValueDto>? Breakdown, string[] Drill)>(
            StringComparer.OrdinalIgnoreCase)
        {
            ["V1"] = ("line", totalSeries, topDepartments, cookieDims),
            ["V2"] = ("line", complaintSeries, topDepartments, cookieDims),
            ["V3"] = ("hbar", null, classMix, ["department", "region", "channel"]),
            ["V4"] = ("hbar", null, items.First(i => i.Id == "V4").Breakdown, ["subject"]),
            ["V5"] = ("hbar", null, topDepartments, ["subject", "channel", "region"]),
            ["V6"] = ("hbar", null, topChannels, ["department", "region", "subjectClass"]),
            ["V7"] = ("hbar", null, topRegions, ["department", "subject", "channel"]),
            ["V8"] = ("line", totalSeries, topDepartments, cookieDims),
            ["V9"] = ("line", criticalSeries, null, mixDims),
            ["V10"] = ("hbar", null, priorityMix, mixDims),
            ["V11"] = ("line", referringSeries, null, mixDims),
            ["V17"] = ("line", SeriesFrom(monthly.Select(m => (m.Label ?? "", (double)m.WithAgent))), null, mixDims),
            ["R1"] = ("line", finishRateSeries, topDepartments, cookieDims),
            ["R2"] = ("line", avgDaysSeries, null, ["department", "region", "subjectClass"]),
            ["R3"] = ("line", unfinishedSeries, topDepartments, cookieDims),
            ["R4"] = ("hbar", null, [new("کارتابل باز", (long)(items.First(i => i.Id == "R4").Value ?? 0))], ["department"]),
            ["R5"] = ("hbar", finishedSeries, items.First(i => i.Id == "R5").Breakdown, cookieDims),
            ["R7"] = ("line", redistribSeries, null, mixDims),
            ["R8"] = ("line", referredSeries, null, mixDims),
            ["R10"] = ("gauge", null, null, ["department", "region"]),
            ["R11"] = ("gauge", null, null, ["department", "region"]),
            ["R12"] = ("gauge", null, null, ["department", "subjectClass"]),
            ["R13"] = ("gauge", null, null, ["department", "subjectClass"]),
            ["R14"] = ("hbar", null, [new("اتمام‌دار", core.Finished), new("کارتابل", (long)(items.First(i => i.Id == "R4").Value ?? 0))], mixDims),
            ["P1"] = ("line", pursuitRateSeries, null, cookieDims),
            ["P2"] = ("gauge", null, null, ["department", "region"]),
            ["A1"] = ("line", replyRateSeries, topDepartments, cookieDims),
            ["A3"] = ("hbar", null, items.First(i => i.Id == "A3").Breakdown, Array.Empty<string>()),
            ["A4"] = ("hbar", null, items.First(i => i.Id == "A4").Breakdown, Array.Empty<string>()),
            ["T1"] = ("gauge", null, [new("تماس ورودی", sat.CallReceivedRows)], Array.Empty<string>()),
            ["T2"] = ("hbar", null, [new("متصل", sat.CallRecordLinked), new("کل CallRecord", sat.CallRecordRows)], Array.Empty<string>()),
            ["T3"] = ("hbar", null, items.First(i => i.Id == "T3").Breakdown, Array.Empty<string>()),
            ["T4"] = ("gauge", null, [new("CallRecord", sat.CallRecordRows)], Array.Empty<string>()),
            ["O1"] = ("hbar", null, topDepartments, ["subject", "channel", "region"]),
            ["O3"] = ("gauge", null, [new("DepartmentChart", sat.DepartmentChartRows)], Array.Empty<string>()),
            ["O4"] = ("gauge", null, [new("RoleMemberAccess", sat.RoleMemberAccessRows)], Array.Empty<string>()),
            ["O5"] = ("line", agentRateSeries, null, mixDims),
            ["E1"] = ("gauge", null, [new("بازدید پیوست", sat.AttachmentVisits)], ["department"]),
            ["L1"] = ("gauge", null, [new("HttpLog", sat.HttpLogRows)], Array.Empty<string>()),
            ["L2"] = ("gauge", null, [new("LoginLog", sat.LoginLogRows)], Array.Empty<string>()),
            ["L3"] = ("gauge", null, [new("CookieLog", sat.CookieLogRows)], Array.Empty<string>()),
            ["O8"] = ("gauge", null, [new("TrackUsers", sat.TrackUsersRows)], Array.Empty<string>()),
        };

        _ = topSubjects;

        for (var i = 0; i < items.Count; i++)
        {
            var item = items[i];
            if (item.Feasibility == "empty")
            {
                items[i] = item with { ChartType = "none", Series = null, DrillDimensions = Array.Empty<string>() };
                continue;
            }

            if (!map.TryGetValue(item.Id, out var cfg))
            {
                items[i] = item with
                {
                    ChartType = item.Breakdown is { Count: > 0 } ? "hbar" : "gauge",
                    Series = null,
                    DrillDimensions = Array.Empty<string>()
                };
                continue;
            }

            items[i] = item with
            {
                ChartType = cfg.Chart,
                Series = cfg.Series,
                Breakdown = cfg.Breakdown ?? item.Breakdown,
                DrillDimensions = cfg.Drill
            };
        }

        return items;
    }

    private static DynamicParameters ToDynamic(Dictionary<string, object?> parameters)
    {
        var dp = new DynamicParameters();
        foreach (var (key, value) in parameters)
        {
            dp.Add(key, value);
        }

        return dp;
    }

    private sealed class MonthlyTrendRow
    {
        public string? Label { get; init; }
        public long Total { get; init; }
        public long Complaints { get; init; }
        public long Finished { get; init; }
        public long Unfinished { get; init; }
        public long WithPursuits { get; init; }
        public long WithAgent { get; init; }
        public long Redistributed { get; init; }
        public long Referred { get; init; }
        public long Critical { get; init; }
        public long Referring { get; init; }
        public double? AvgDays { get; init; }
    }

    private sealed class MonthlyReplyRow
    {
        public string? Label { get; init; }
        public long Total { get; init; }
        public long WithReply { get; init; }
    }

    private sealed class CoreMetricsRow
    {
        public long TotalCases { get; init; }
        public long Complaints { get; init; }
        public long NonComplaints { get; init; }
        public long Finished { get; init; }
        public long Unfinished { get; init; }
        public double? AvgResolutionDays { get; init; }
        public long CriticalCases { get; init; }
        public long ReferringCases { get; init; }
        public long WithAgent { get; init; }
        public long WithPursuits { get; init; }
        public double? AvgPursuits { get; init; }
        public long Cancelled { get; init; }
        public long WithDeadline { get; init; }
        public long WithCause { get; init; }
        public long WithGift { get; init; }
        public long DistinctSubjects { get; init; }
        public long DistinctGroups { get; init; }
        public long DistinctNatures { get; init; }
        public long DistinctZones { get; init; }
        public long DistinctDepartments { get; init; }
        public long DistinctChannels { get; init; }
        public long DistinctPriorities { get; init; }
        public long StatusRedistributed { get; init; }
        public long StatusReferred { get; init; }
    }

    private sealed class FlowMetricsRow
    {
        public long FlowRows { get; init; }
        public long CookiesWithFlow { get; init; }
        public long CookiesWithReply { get; init; }
        public long DelayRows { get; init; }
        public long DiscontentRows { get; init; }
        public long ReferToUserFilled { get; init; }
    }

    private sealed class StepsFirstRow
    {
        public double? AvgSteps { get; init; }
        public double? AvgFirstHours { get; init; }
    }

    private sealed class InformMetricsRow
    {
        public long DistinctRegions { get; init; }
        public long WithArea { get; init; }
        public long WithDistrict { get; init; }
        public long WithSegment { get; init; }
    }

    private sealed class SatelliteRow
    {
        public long SentboxRows { get; init; }
        public long InboxRows { get; init; }
        public long CallReceivedRows { get; init; }
        public long CallRecordRows { get; init; }
        public long CallRecordLinked { get; init; }
        public long AttachmentVisits { get; init; }
        public long PursuitRows { get; init; }
        public long PursuitReplies { get; init; }
        public long FaqRows { get; init; }
        public long GiftRows { get; init; }
        public long PersonnelRows { get; init; }
        public long MissionRows { get; init; }
        public long CheckListRows { get; init; }
        public long ChatRoomRows { get; init; }
        public long ReferalRows { get; init; }
        public long ReminderRows { get; init; }
        public long DictionaryRows { get; init; }
        public long DistrictRows { get; init; }
        public long SegmentRows { get; init; }
        public long FieldTypeRows { get; init; }
        public long PursuitTemplateRows { get; init; }
        public long RoleMemberAccessRows { get; init; }
        public long DepartmentChartRows { get; init; }
        public long TrackUsersRows { get; init; }
        public long HttpLogRows { get; init; }
        public long LoginLogRows { get; init; }
        public long CookieLogRows { get; init; }
    }
}
