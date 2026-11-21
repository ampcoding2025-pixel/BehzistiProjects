using AiTicket.Api.Contracts;
using AiTicket.Api.Infrastructure.Analytics;
using AiTicket.Api.Infrastructure.Didban;
using Dapper;
using Microsoft.Extensions.Options;

namespace AiTicket.Api.Modules.Analytics;

public sealed partial class DidbanAnalyticsQueryService(
    IDidbanConnectionFactory connectionFactory,
    IOptions<AnalyticsOptions> analyticsOptions,
    IOptions<DidbanOptions> didbanOptions,
    ILogger<DidbanAnalyticsQueryService> logger) : IAnalyticsQueryService
{
    private readonly AnalyticsOptions _analytics = analyticsOptions.Value;
    private readonly DidbanOptions _didban = didbanOptions.Value;

    /// <summary>SubjectId 357 = پیامهای صوتی غیر قابل پیگیری (docs/12).</summary>
    private const int VoiceNoiseSubjectId = 357;

    public async Task<ExecutiveDashboardResponse> GetExecutiveAsync(
        PeriodFilter filter,
        CancellationToken ct,
        bool bypassCache = false)
    {
        _ = bypassCache; // cache handled by CachingAnalyticsQueryService decorator
        await using var connection = await connectionFactory.OpenReadOnlyAsync(ct);
        var (whereSql, parameters) = SqlFilterBuilder.BuildCookieWhere(filter, _analytics.DefaultCookieTypeId);
        var dp = ToDynamic(parameters);

        const string volumeSql = """
            SELECT
              COUNT_BIG(*) AS Total,
              SUM(CASE WHEN c.SubjectClassId = 1 THEN 1 ELSE 0 END) AS Complaints,
              SUM(CASE WHEN c.SubjectClassId <> 1 THEN 1 ELSE 0 END) AS NonComplaints,
              SUM(CASE WHEN c.CookieFinishTime IS NOT NULL THEN 1 ELSE 0 END) AS Finished,
              SUM(CASE WHEN c.CookieFinishTime IS NULL THEN 1 ELSE 0 END) AS Unfinished,
              AVG(CASE WHEN c.CookieFinishTime IS NOT NULL
                       THEN CAST(DATEDIFF(day, c.CookieTime, c.CookieFinishTime) AS float) END) AS AvgResolutionDays
            FROM dbo.Cookie c
            {0}
            """;

        var volume = await connection.QuerySingleAsync<VolumeRow>(
            new CommandDefinition(string.Format(volumeSql, whereSql), dp, cancellationToken: ct));

        var classDist = (await connection.QueryAsync<NamedValueDto>(
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

        var channelDist = (await connection.QueryAsync<NamedValueDto>(
            new CommandDefinition(
                $"""
                SELECT ch.CookieChannelName AS Name, COUNT_BIG(*) AS Value
                FROM dbo.Cookie c
                INNER JOIN dbo.CookieChannel ch ON ch.CookieChannelId = c.CookieChannelId
                {whereSql}
                GROUP BY ch.CookieChannelName
                ORDER BY Value DESC
                """,
                dp,
                cancellationToken: ct))).ToList();

        var topSubjects = (await connection.QueryAsync<NamedValueDto>(
            new CommandDefinition(
                $"""
                SELECT TOP 10 s.SubjectName AS Name, COUNT_BIG(*) AS Value
                FROM dbo.Cookie c
                INNER JOIN dbo.Subject s ON s.SubjectId = c.SubjectId
                {whereSql}
                GROUP BY s.SubjectName
                ORDER BY Value DESC
                """,
                dp,
                cancellationToken: ct))).ToList();

        var topDepartments = (await connection.QueryAsync<NamedValueDto>(
            new CommandDefinition(
                $"""
                SELECT TOP 10 d.DepartmentName AS Name, COUNT_BIG(*) AS Value
                FROM dbo.Cookie c
                INNER JOIN dbo.Department d ON d.DepartmentId = c.DepartmentId
                {whereSql}
                GROUP BY d.DepartmentName
                ORDER BY Value DESC
                """,
                dp,
                cancellationToken: ct))).ToList();

        // Decision coverage: class-split + voice noise (357) + auto-register dead-end
        var decision = await connection.QuerySingleAsync<DecisionCoverageRow>(
            new CommandDefinition(
                $"""
                SELECT
                  COUNT_BIG(*) AS Eligible,
                  COUNT_BIG(replied.CookieId) AS WithReply,
                  SUM(CASE WHEN c.SubjectClassId = 1 THEN 1 ELSE 0 END) AS ComplaintEligible,
                  SUM(CASE WHEN c.SubjectClassId = 1 AND replied.CookieId IS NOT NULL THEN 1 ELSE 0 END) AS ComplaintWithReply,
                  SUM(CASE WHEN c.SubjectClassId = 3 THEN 1 ELSE 0 END) AS GuidanceEligible,
                  SUM(CASE WHEN c.SubjectClassId = 3 AND replied.CookieId IS NOT NULL THEN 1 ELSE 0 END) AS GuidanceWithReply,
                  SUM(CASE WHEN c.SubjectClassId = 1 AND c.SubjectId = {VoiceNoiseSubjectId} THEN 1 ELSE 0 END) AS VoiceComplaintEligible,
                  SUM(CASE WHEN c.SubjectClassId = 1 AND ISNULL(c.SubjectId, 0) <> {VoiceNoiseSubjectId} THEN 1 ELSE 0 END) AS ComplaintExVoiceEligible,
                  SUM(CASE WHEN c.SubjectClassId = 1 AND ISNULL(c.SubjectId, 0) <> {VoiceNoiseSubjectId} AND replied.CookieId IS NOT NULL THEN 1 ELSE 0 END) AS ComplaintExVoiceWithReply,
                  SUM(CASE WHEN c.SubjectClassId = 1 AND d.DepartmentName = N'ثبت خودکار' THEN 1 ELSE 0 END) AS AutoComplaintEligible,
                  SUM(CASE WHEN c.SubjectClassId = 1 AND d.DepartmentName = N'ثبت خودکار' AND replied.CookieId IS NOT NULL THEN 1 ELSE 0 END) AS AutoComplaintWithReply
                FROM dbo.Cookie c
                LEFT JOIN dbo.Department d ON d.DepartmentId = c.DepartmentId
                LEFT JOIN (
                  SELECT DISTINCT f.CookieId
                  FROM dbo.CookieFlow f
                  WHERE f.CookieFlowReplyCitizen IS NOT NULL
                    AND LEN(LTRIM(RTRIM(f.CookieFlowReplyCitizen))) > 0
                ) replied ON replied.CookieId = c.CookieId
                {whereSql}
                """,
                dp,
                cancellationToken: ct));

        var volumeTrendRows = (await connection.QueryAsync<VolumeTrendRow>(
            new CommandDefinition(
                $"""
                SELECT
                  CONCAT(
                    CAST(YEAR(c.CookieTime) AS nvarchar(4)),
                    N'/',
                    RIGHT(CONCAT(N'0', CAST(MONTH(c.CookieTime) AS nvarchar(2))), 2)
                  ) AS Label,
                  COUNT_BIG(*) AS Requests,
                  SUM(CASE WHEN c.SubjectClassId = 1 THEN 1 ELSE 0 END) AS Complaints
                FROM dbo.Cookie c
                {whereSql}
                GROUP BY YEAR(c.CookieTime), MONTH(c.CookieTime)
                ORDER BY YEAR(c.CookieTime), MONTH(c.CookieTime)
                """,
                dp,
                cancellationToken: ct))).ToList();

        var total = volume.Total;
        var resolutionRate = total == 0 ? 0 : Math.Round(100.0 * volume.Finished / total, 1);
        var availablePercent = Pct(decision.WithReply, decision.Eligible);
        var d1Complaint = Pct(decision.ComplaintWithReply, decision.ComplaintEligible);
        var d1Guidance = Pct(decision.GuidanceWithReply, decision.GuidanceEligible);
        var d1ExVoice = Pct(decision.ComplaintExVoiceWithReply, decision.ComplaintExVoiceEligible);
        var voiceShare = Pct(decision.VoiceComplaintEligible, decision.ComplaintEligible);
        var autoCov = Pct(decision.AutoComplaintWithReply, decision.AutoComplaintEligible);
        var complaintShare = Pct(volume.Complaints, total);
        var topSubject = topSubjects.FirstOrDefault();
        var topSubjectShare = topSubject is null ? 0 : Pct(topSubject.Value, total);

        var kpis = new List<KpiCardDto>
        {
            new("total-requests", "تعداد کل پرونده‌ها", total, "count", null, "neutral",
                "همه درخواست‌های ثبت‌شده در بازه انتخابی", "feasible"),
            new("total-complaints", "تعداد شکایت‌ها", volume.Complaints, "count", null, "warning",
                "پرونده‌هایی که طبقه آن‌ها «شکایت» است", "feasible"),
            new("complaint-share", "درصد شکایت از کل پرونده‌ها", complaintShare, "percent", null, "neutral",
                "چه سهمی از پرونده‌ها شکایت هستند", "feasible"),
            new("d1-complaint", "درصد شکایت‌های دارای پاسخ کتبی", d1Complaint, "percent", null,
                d1Complaint >= 50 ? "positive" : "warning",
                "چند درصد شکایت‌ها پاسخ متنی به شهروند دارند (نه تأیید صحت حقوقی)", "feasible"),
            new("d1-complaint-ex-voice", "درصد شکایت پاسخ‌داده‌شده (بدون پیام صوتی پیگیری‌نشده)", d1ExVoice, "percent", null,
                d1ExVoice >= 70 ? "positive" : "warning",
                "همان شاخص قبلی، بدون موضوع «پیام‌های صوتی غیرقابل پیگیری»", "feasible"),
            new("d1-guidance", "درصد راهنمایی‌های دارای پاسخ کتبی", d1Guidance, "percent", null,
                d1Guidance < 5 ? "critical" : "warning",
                "چند درصد پرونده‌های راهنمایی پاسخ متنی دارند", "feasible"),
            new("voice-noise-share", "درصد شکایت‌های پیام صوتی غیرقابل پیگیری", voiceShare, "percent", null, "warning",
                "سهم شکایت‌هایی که موضوعشان پیام صوتی غیرقابل پیگیری است", "feasible"),
            new("auto-register-deadend", "تعداد شکایت روی واحد ثبت خودکار",
                decision.AutoComplaintEligible, "count", null,
                decision.AutoComplaintEligible > 0 && autoCov < 5 ? "critical" : "neutral",
                $"از این تعداد، حدود {autoCov}٪ پاسخ کتبی دارند", "feasible"),
            new("non-complaint", "تعداد پرونده‌های غیرشکایت", volume.NonComplaints, "count", null, "positive",
                "راهنمایی، گزارش، پیشنهاد و سایر طبقات غیرشکایت", "feasible"),
            new("answer-coverage", "درصد کل پرونده‌های دارای پاسخ کتبی", availablePercent, "percent", null, "warning",
                "میانگین همه طبقات با هم؛ برای مقایسه شکایت و راهنمایی را جدا ببینید", "feasible"),
            new("resolved", "تعداد پرونده‌های دارای زمان اتمام", volume.Finished, "count", null, "positive",
                "هنوز تعریف رسمی «بسته شدن» تأیید نشده است", "needs_rules"),
            new("unresolved", "تعداد پرونده‌های بدون زمان اتمام", volume.Unfinished, "count", null, "neutral",
                "هنوز تعریف رسمی «باز بودن» تأیید نشده است", "needs_rules"),
            new("avg-resolution", "میانگین روز تا اتمام پرونده",
                volume.AvgResolutionDays is null ? null : Math.Round(volume.AvgResolutionDays.Value, 1),
                "days", null, "warning", "بدون حذف موارد پرت؛ تعریف اتمام هنوز قطعی نیست", "needs_rules"),
            new("resolution-rate", "درصد پرونده‌های دارای زمان اتمام", resolutionRate, "percent", null, "positive",
                "تعریف رسمی بسته‌شدن هنوز تأیید نشده است", "needs_rules"),
            new("sla", "رعایت مهلت پاسخ", null, "percent", null, "critical",
                "در دیده‌بان مهلت ثبت نشده؛ فعلاً قابل نمایش نیست", "unavailable"),
        };

        var brief = BuildDecisionBrief(
            SqlFilterBuilder.PeriodLabel(filter),
            total,
            complaintShare,
            availablePercent,
            d1Complaint,
            d1Guidance,
            d1ExVoice,
            voiceShare,
            decision.VoiceComplaintEligible,
            decision.AutoComplaintEligible,
            autoCov,
            topSubject?.Name,
            topSubjectShare);

        logger.LogInformation(
            "Executive aggregates computed. Total={Total} D1c={D1c} D1g={D1g} D1x={D1x} RuleSet={RuleSet}",
            total, d1Complaint, d1Guidance, d1ExVoice, _analytics.RuleSetVersion);

        var volumeTrend = volumeTrendRows
            .Select(r => new VolumeTrendPointDto(r.Label ?? "", r.Requests, r.Complaints))
            .ToList();

        return new ExecutiveDashboardResponse(
            new MetaDto("didban", DateTimeOffset.UtcNow, SqlFilterBuilder.PeriodLabel(filter)),
            _analytics.RuleSetVersion,
            kpis,
            volumeTrend,
            classDist,
            channelDist,
            topSubjects,
            topDepartments,
            new AnswerCoverageDto(
                availablePercent,
                null,
                null,
                "unavailable",
                "پوشش بر اساس CookieFlowReplyCitizen است. اعتبار قانونی نسخه‌بندی در دیده‌بان موجود نیست. برای تصمیم از D1c/D1g/D1x استفاده کنید.",
                d1Complaint,
                d1Guidance,
                d1ExVoice,
                decision.VoiceComplaintEligible,
                voiceShare,
                decision.AutoComplaintEligible,
                autoCov),
            brief);
    }

    private static double Pct(long numerator, long denominator) =>
        denominator == 0 ? 0 : Math.Round(100.0 * numerator / denominator, 1);

    private static DecisionBriefDto BuildDecisionBrief(
        string periodLabel,
        long total,
        double complaintShare,
        double d1Blended,
        double d1Complaint,
        double d1Guidance,
        double d1ExVoice,
        double voiceShare,
        long voiceCount,
        long autoCount,
        double autoCov,
        string? topSubjectName,
        double topSubjectShare)
    {
        var bigIdea =
            $"در {periodLabel} حدود {total:N0} پرونده با سهم شکایت ≈ {complaintShare:0.#}٪؛ " +
            $"پوشش پاسخ شکایت (D1c) ≈ {d1Complaint:0.#}٪ در برابر راهنمایی (D1g) ≈ {d1Guidance:0.#}٪ — " +
            $"عدد ترکیبی D1≈{d1Blended:0.#}٪ برای تصمیم‌گیری کافی نیست.";

        var insights = new List<DecisionInsightDto>
        {
            new(
                "split-d1",
                "پوشش پاسخ را بر اساس طبقه جدا کنید",
                $"D1c≈{d1Complaint:0.#}٪ و D1g≈{d1Guidance:0.#}٪؛ مدیریت روی D1 ترکیبی ({d1Blended:0.#}٪) تصویر غلط می‌دهد.",
                "attention",
                "P0"),
            new(
                "voice-noise",
                "نویز صوتی غیرقابل پیگیری صف شکایت را آلوده می‌کند",
                voiceCount > 0
                    ? $"حدود {voiceCount:N0} شکایت موضوع ۳۵۷ (≈{voiceShare:0.#}٪ شکایت‌ها) با پوشش پاسخ ≈۰٪. D1x (بدون نویز) ≈ {d1ExVoice:0.#}٪."
                    : "در این بازه شکایت نویز صوتی دیده نشد.",
                "attention",
                "P0"),
            new(
                "auto-register",
                "ثبت خودکار بن‌بست پاسخ شکایت است",
                autoCount > 0
                    ? $"{autoCount:N0} شکایت روی «ثبت خودکار» با پوشش پاسخ ≈ {autoCov:0.#}٪ — در حالی‌که رؤسای شهرستان معمولاً بالای ۹۰٪اند."
                    : "شکایت ثبت‌خودکار در این فیلتر نیست.",
                "attention",
                "P0"),
            new(
                "top-subject",
                "تمرکز موضوعی برای بسته پاسخ",
                string.IsNullOrWhiteSpace(topSubjectName)
                    ? "موضوع پرتکرار در این بازه خالی است."
                    : $"پرتکرارترین موضوع «{topSubjectName}» ≈ {topSubjectShare:0.#}٪ حجم است — کاندید بسته پاسخ انسان‌محور (بدون ارسال خودکار).",
                "opportunity",
                "P1"),
            new(
                "rules-appendix",
                "شاخص‌های FinishTime/SLA هنوز تصمیم‌پذیر نیستند",
                "B1/B2/B3 نیازمند امضای قاعده؛ C3 به‌خاطر Deadline خالی unavailable است.",
                "info",
                "P2"),
        };

        return new DecisionBriefDto(bigIdea, insights);
    }

    public Task<RequestAnalyticsResponse> GetRequestsAsync(PeriodFilter filter, CancellationToken ct) =>
        SqlTransient.ExecuteAsync(() => GetRequestsCoreAsync(filter, ct), logger, ct);

    private async Task<RequestAnalyticsResponse> GetRequestsCoreAsync(PeriodFilter filter, CancellationToken ct)
    {
        await using var connection = await connectionFactory.OpenReadOnlyAsync(ct);
        var (whereSql, parameters) = SqlFilterBuilder.BuildCookieWhere(filter, _analytics.DefaultCookieTypeId);
        var dp = ToDynamic(parameters);
        CommandDefinition Cmd(string sql) =>
            new(sql, dp, commandTimeout: _didban.CommandTimeoutSeconds, cancellationToken: ct);

        var totals = await connection.QuerySingleAsync<VolumeRow>(
            Cmd(
                $"""
                SELECT
                  COUNT_BIG(*) AS Total,
                  SUM(CASE WHEN c.SubjectClassId = 1 THEN 1 ELSE 0 END) AS Complaints,
                  SUM(CASE WHEN c.SubjectClassId <> 1 THEN 1 ELSE 0 END) AS NonComplaints,
                  SUM(CASE WHEN c.CookieFinishTime IS NOT NULL THEN 1 ELSE 0 END) AS Finished,
                  SUM(CASE WHEN c.CookieFinishTime IS NULL THEN 1 ELSE 0 END) AS Unfinished,
                  CAST(NULL AS float) AS AvgResolutionDays
                FROM dbo.Cookie c
                {whereSql}
                """));

        var byClass = (await connection.QueryAsync<NamedValueDto>(
            Cmd(
                $"""
                SELECT sc.SubjectClassId AS Id, sc.SubjectClassName AS Name, COUNT_BIG(*) AS Value
                FROM dbo.Cookie c
                INNER JOIN dbo.SubjectClass sc ON sc.SubjectClassId = c.SubjectClassId
                {whereSql}
                GROUP BY sc.SubjectClassId, sc.SubjectClassName
                ORDER BY Value DESC
                """))).ToList();

        var byChannel = (await connection.QueryAsync<NamedValueDto>(
            Cmd(
                $"""
                SELECT ch.CookieChannelId AS Id, ch.CookieChannelName AS Name, COUNT_BIG(*) AS Value
                FROM dbo.Cookie c
                INNER JOIN dbo.CookieChannel ch ON ch.CookieChannelId = c.CookieChannelId
                {whereSql}
                GROUP BY ch.CookieChannelId, ch.CookieChannelName
                ORDER BY Value DESC
                """))).ToList();

        var byRegion = (await connection.QueryAsync<NamedValueDto>(
            Cmd(
                $"""
                SELECT r.RegionId AS Id, r.RegionName AS Name, COUNT_BIG(*) AS Value
                FROM dbo.Cookie c
                INNER JOIN dbo.Inform i ON i.CookieId = c.CookieId
                INNER JOIN dbo.Region r ON r.RegionId = i.RegionId
                {whereSql}
                GROUP BY r.RegionId, r.RegionName
                ORDER BY Value DESC
                """))).ToList();

        var byGroup = (await connection.QueryAsync<NamedValueDto>(
            Cmd(
                $"""
                SELECT TOP 15 sg.SubjectGroupId AS Id, sg.SubjectGroupName AS Name, COUNT_BIG(*) AS Value
                FROM dbo.Cookie c
                INNER JOIN dbo.SubjectGroup sg ON sg.SubjectGroupId = c.SubjectGroupId
                {whereSql}
                GROUP BY sg.SubjectGroupId, sg.SubjectGroupName
                ORDER BY Value DESC
                """))).ToList();

        var complaintShare = totals.Total == 0 ? 0 : Math.Round(100.0 * totals.Complaints / totals.Total, 1);
        var guidance = byClass.FirstOrDefault(x => x.Name.Contains("راهنمایی", StringComparison.Ordinal));
        var guidanceShare = totals.Total == 0 || guidance is null
            ? 0
            : Math.Round(100.0 * guidance.Value / totals.Total, 1);

        var openClosed = new List<NamedValueDto>
        {
            new("باز", totals.Unfinished),
            new("بسته‌شده", totals.Finished),
        };

        var openClosedTrend = (await connection.QueryAsync<OpenClosedTrendRow>(
            Cmd(
                $"""
                SELECT
                  CONCAT(
                    CAST(YEAR(c.CookieTime) AS nvarchar(4)),
                    N'/',
                    RIGHT(CONCAT(N'0', CAST(MONTH(c.CookieTime) AS nvarchar(2))), 2)
                  ) AS Label,
                  COUNT_BIG(*) AS Requests,
                  SUM(CASE WHEN c.CookieFinishTime IS NOT NULL THEN 1 ELSE 0 END) AS Closed
                FROM dbo.Cookie c
                {whereSql}
                GROUP BY YEAR(c.CookieTime), MONTH(c.CookieTime)
                ORDER BY YEAR(c.CookieTime), MONTH(c.CookieTime)
                """))).ToList();

        var flowStatusExtra = filter.CookieStatusId is null
            ? ""
            : " AND f.CookieStatusId = @cookieStatusId ";

        var byWorkflowStep = (await connection.QueryAsync<NamedValueDto>(
            Cmd(
                $"""
                SELECT TOP 15 s.CookieStatusId AS Id, s.CookieStatusName AS Name, COUNT_BIG(*) AS Value
                FROM dbo.Cookie c
                INNER JOIN dbo.CookieFlow f ON f.CookieId = c.CookieId
                INNER JOIN dbo.CookieStatus s ON s.CookieStatusId = f.CookieStatusId
                {whereSql}
                GROUP BY s.CookieStatusId, s.CookieStatusName
                ORDER BY Value DESC
                """))).ToList();

        // Ratio zone formula: Value / TotalHours = sum(volume) / sum(time spent), open included where applicable.
        var byFlowActor = (await connection.QueryAsync<WorkloadUserDto>(
            Cmd(
                $"""
                SELECT TOP 12
                  u.UserId AS Id,
                  COALESCE(NULLIF(LTRIM(RTRIM(CONCAT(ISNULL(u.UserFirstName, N''), N' ', ISNULL(u.UserLastName, N'')))), N''), u.UserName, N'کاربر ' + CAST(u.UserId AS nvarchar(20))) AS Name,
                  COUNT_BIG(*) AS Value,
                  AVG(CASE
                        WHEN f.CookieFlowFinishTime IS NOT NULL AND f.CookieFlowTime IS NOT NULL
                         AND f.CookieFlowFinishTime >= f.CookieFlowTime
                        THEN CAST(DATEDIFF(hour, f.CookieFlowTime, f.CookieFlowFinishTime) AS float)
                      END) AS AvgHours,
                  SUM(CASE
                        WHEN f.CookieFlowFinishTime IS NOT NULL AND f.CookieFlowTime IS NOT NULL
                         AND f.CookieFlowFinishTime >= f.CookieFlowTime
                        THEN CAST(DATEDIFF(hour, f.CookieFlowTime, f.CookieFlowFinishTime) AS float)
                      END) AS TotalHours,
                  SUM(CASE WHEN f.CookieFlowFinishTime IS NOT NULL THEN 1 ELSE 0 END) AS FinishedCount,
                  AVG(CASE
                        WHEN f.CookieFlowFinishTime IS NOT NULL AND f.CookieFlowTime IS NOT NULL
                         AND f.CookieFlowFinishTime >= f.CookieFlowTime
                        THEN CAST(DATEDIFF(hour, f.CookieFlowTime, f.CookieFlowFinishTime) AS float)
                      END) AS AvgHoursFinished
                FROM dbo.Cookie c
                INNER JOIN dbo.CookieFlow f ON f.CookieId = c.CookieId
                INNER JOIN dbo.UserInfo u ON u.UserId = COALESCE(f.CookieFlowUserId, f.UserId, f.InsertUserId)
                {whereSql}
                {flowStatusExtra}
                GROUP BY u.UserId, u.UserFirstName, u.UserLastName, u.UserName
                ORDER BY Value DESC
                """))).ToList();

        var byFlowReferred = (await connection.QueryAsync<WorkloadUserDto>(
            Cmd(
                $"""
                SELECT TOP 12
                  u.UserId AS Id,
                  COALESCE(NULLIF(LTRIM(RTRIM(CONCAT(ISNULL(u.UserFirstName, N''), N' ', ISNULL(u.UserLastName, N'')))), N''), u.UserName, N'کاربر ' + CAST(u.UserId AS nvarchar(20))) AS Name,
                  COUNT_BIG(*) AS Value,
                  AVG(CASE
                        WHEN f.CookieFlowFinishTime IS NOT NULL AND f.CookieFlowTime IS NOT NULL
                         AND f.CookieFlowFinishTime >= f.CookieFlowTime
                        THEN CAST(DATEDIFF(hour, f.CookieFlowTime, f.CookieFlowFinishTime) AS float)
                      END) AS AvgHours,
                  SUM(CASE
                        WHEN f.CookieFlowFinishTime IS NOT NULL AND f.CookieFlowTime IS NOT NULL
                         AND f.CookieFlowFinishTime >= f.CookieFlowTime
                        THEN CAST(DATEDIFF(hour, f.CookieFlowTime, f.CookieFlowFinishTime) AS float)
                      END) AS TotalHours,
                  SUM(CASE WHEN f.CookieFlowFinishTime IS NOT NULL THEN 1 ELSE 0 END) AS FinishedCount,
                  AVG(CASE
                        WHEN f.CookieFlowFinishTime IS NOT NULL AND f.CookieFlowTime IS NOT NULL
                         AND f.CookieFlowFinishTime >= f.CookieFlowTime
                        THEN CAST(DATEDIFF(hour, f.CookieFlowTime, f.CookieFlowFinishTime) AS float)
                      END) AS AvgHoursFinished
                FROM dbo.Cookie c
                INNER JOIN dbo.CookieFlow f ON f.CookieId = c.CookieId
                INNER JOIN dbo.UserInfo u ON u.UserId = COALESCE(f.ReferToUserId, f.CookieFlowVisitedUserId)
                {whereSql}
                {flowStatusExtra}
                GROUP BY u.UserId, u.UserFirstName, u.UserLastName, u.UserName
                ORDER BY Value DESC
                """))).ToList();

        // No TOP — tables need full cohort for search/filter; scatter plots a display subset client-side.
        // TotalHours sums elapsed for finished + still-open (Finish→GETDATE)
        var byCartableUser = (await connection.QueryAsync<WorkloadUserDto>(
            Cmd(
                $"""
                SELECT
                  u.UserId AS Id,
                  COALESCE(NULLIF(LTRIM(RTRIM(CONCAT(ISNULL(u.UserFirstName, N''), N' ', ISNULL(u.UserLastName, N'')))), N''), u.UserName, N'کاربر ' + CAST(u.UserId AS nvarchar(20))) AS Name,
                  COUNT_BIG(*) AS Value,
                  AVG(CASE
                        WHEN ct.CartableTime IS NOT NULL
                        THEN CAST(DATEDIFF(hour, ct.CartableTime, COALESCE(ct.CartableFinishTime, GETDATE())) AS float)
                      END) AS AvgHours,
                  SUM(CASE
                        WHEN ct.CartableTime IS NOT NULL
                        THEN CAST(DATEDIFF(hour, ct.CartableTime, COALESCE(ct.CartableFinishTime, GETDATE())) AS float)
                      END) AS TotalHours,
                  SUM(CASE WHEN ct.CartableFinishTime IS NOT NULL THEN 1 ELSE 0 END) AS FinishedCount,
                  AVG(CASE
                        WHEN ct.CartableFinishTime IS NOT NULL AND ct.CartableTime IS NOT NULL
                         AND ct.CartableFinishTime >= ct.CartableTime
                        THEN CAST(DATEDIFF(hour, ct.CartableTime, ct.CartableFinishTime) AS float)
                      END) AS AvgHoursFinished
                FROM dbo.Cookie c
                INNER JOIN dbo.Cartable ct ON ct.CookieId = c.CookieId
                INNER JOIN dbo.UserInfo u ON u.UserId = ct.CartableUserId
                {whereSql}
                GROUP BY u.UserId, u.UserFirstName, u.UserLastName, u.UserName
                ORDER BY Value DESC
                """))).ToList();

        var byCallUser = (await connection.QueryAsync<WorkloadUserDto>(
            Cmd(
                $"""
                SELECT
                  u.UserId AS Id,
                  COALESCE(NULLIF(LTRIM(RTRIM(CONCAT(ISNULL(u.UserFirstName, N''), N' ', ISNULL(u.UserLastName, N'')))), N''), u.UserName, N'کاربر ' + CAST(u.UserId AS nvarchar(20))) AS Name,
                  COUNT_BIG(*) AS Value,
                  AVG(CASE
                        WHEN c.CookieTime IS NOT NULL
                        THEN CAST(DATEDIFF(hour, c.CookieTime, COALESCE(c.CookieFinishTime, GETDATE())) AS float)
                      END) AS AvgHours,
                  SUM(CASE
                        WHEN c.CookieTime IS NOT NULL
                        THEN CAST(DATEDIFF(hour, c.CookieTime, COALESCE(c.CookieFinishTime, GETDATE())) AS float)
                      END) AS TotalHours,
                  SUM(CASE WHEN c.CookieFinishTime IS NOT NULL THEN 1 ELSE 0 END) AS FinishedCount,
                  AVG(CASE
                        WHEN c.CookieFinishTime IS NOT NULL AND c.CookieTime IS NOT NULL
                         AND c.CookieFinishTime >= c.CookieTime
                        THEN CAST(DATEDIFF(hour, c.CookieTime, c.CookieFinishTime) AS float)
                      END) AS AvgHoursFinished
                FROM dbo.Cookie c
                INNER JOIN dbo.CallRecord cr ON cr.CookieId = c.CookieId
                INNER JOIN dbo.UserInfo u ON u.UserId = cr.UserId
                {whereSql}
                GROUP BY u.UserId, u.UserFirstName, u.UserLastName, u.UserName
                ORDER BY Value DESC
                """))).ToList();

        var byCaseUser = (await connection.QueryAsync<WorkloadUserDto>(
            Cmd(
                $"""
                SELECT
                  u.UserId AS Id,
                  COALESCE(NULLIF(LTRIM(RTRIM(CONCAT(ISNULL(u.UserFirstName, N''), N' ', ISNULL(u.UserLastName, N'')))), N''), u.UserName, N'کاربر ' + CAST(u.UserId AS nvarchar(20))) AS Name,
                  COUNT_BIG(*) AS Value,
                  AVG(CASE
                        WHEN c.CookieTime IS NOT NULL
                        THEN CAST(DATEDIFF(hour, c.CookieTime, COALESCE(c.CookieFinishTime, GETDATE())) AS float)
                      END) AS AvgHours,
                  SUM(CASE
                        WHEN c.CookieTime IS NOT NULL
                        THEN CAST(DATEDIFF(hour, c.CookieTime, COALESCE(c.CookieFinishTime, GETDATE())) AS float)
                      END) AS TotalHours,
                  SUM(CASE WHEN c.CookieFinishTime IS NOT NULL THEN 1 ELSE 0 END) AS FinishedCount,
                  AVG(CASE
                        WHEN c.CookieFinishTime IS NOT NULL AND c.CookieTime IS NOT NULL
                         AND c.CookieFinishTime >= c.CookieTime
                        THEN CAST(DATEDIFF(hour, c.CookieTime, c.CookieFinishTime) AS float)
                      END) AS AvgHoursFinished
                FROM dbo.Cookie c
                INNER JOIN dbo.UserInfo u ON u.UserId = COALESCE(c.CookieUserId, c.UserId)
                {whereSql}
                GROUP BY u.UserId, u.UserFirstName, u.UserLastName, u.UserName
                ORDER BY Value DESC
                """))).ToList();

        var summary = new List<KpiCardDto>
        {
            new("period-total", "حجم دوره", totals.Total, "count", null, "neutral", null, "feasible"),
            new("period-complaints", "شکایت در دوره", totals.Complaints, "count", null, "warning", null, "feasible"),
            new("complaint-share", "سهم شکایت", complaintShare, "percent", null, "neutral", null, "feasible"),
            new("guidance-share", "سهم راهنمایی", guidanceShare, "percent", null, "positive", null, "feasible"),
        };

        return new RequestAnalyticsResponse(
            new MetaDto("didban", DateTimeOffset.UtcNow, SqlFilterBuilder.PeriodLabel(filter)),
            _analytics.RuleSetVersion,
            summary,
            byClass,
            byChannel,
            byRegion,
            byGroup,
            openClosed,
            openClosedTrend.Select(r => new OpenClosedTrendPointDto(r.Label ?? "", r.Requests, r.Closed)).ToList(),
            byWorkflowStep,
            byFlowActor,
            byFlowReferred,
            byCartableUser,
            byCallUser,
            byCaseUser);
    }

    public async Task<KpiValuesResponse> GetKpiValuesAsync(
        PeriodFilter filter,
        IReadOnlyList<string>? codes,
        CancellationToken ct)
    {
        var executive = await GetExecutiveAsync(filter, ct);
        var map = new Dictionary<string, KpiCardDto>(StringComparer.OrdinalIgnoreCase)
        {
            ["A1"] = executive.Kpis.First(k => k.Id == "total-requests"),
            ["A2"] = executive.Kpis.First(k => k.Id == "total-complaints"),
            ["A3"] = executive.Kpis.First(k => k.Id == "non-complaint"),
            ["B1"] = executive.Kpis.First(k => k.Id == "resolution-rate"),
            ["B2"] = executive.Kpis.First(k => k.Id == "avg-resolution"),
            ["B3"] = executive.Kpis.First(k => k.Id == "unresolved"),
            ["D1"] = executive.Kpis.First(k => k.Id == "answer-coverage"),
            ["D1c"] = executive.Kpis.First(k => k.Id == "d1-complaint"),
            ["D1g"] = executive.Kpis.First(k => k.Id == "d1-guidance"),
            ["D1x"] = executive.Kpis.First(k => k.Id == "d1-complaint-ex-voice"),
            ["N1"] = executive.Kpis.First(k => k.Id == "voice-noise-share"),
            ["N2"] = executive.Kpis.First(k => k.Id == "auto-register-deadend"),
            ["A2s"] = executive.Kpis.First(k => k.Id == "complaint-share"),
            ["C3"] = executive.Kpis.First(k => k.Id == "sla"),
        };

        IEnumerable<KeyValuePair<string, KpiCardDto>> selected = map;
        if (codes is { Count: > 0 })
        {
            var set = codes.Select(c => c.Trim()).Where(c => c.Length > 0).ToHashSet(StringComparer.OrdinalIgnoreCase);
            selected = map.Where(kv => set.Contains(kv.Key));
        }

        var now = DateTimeOffset.UtcNow;
        var values = selected
            .Select(kv => new KpiValueDto(kv.Key, kv.Value.Feasibility, kv.Value.Value, kv.Value.Unit ?? "count", now))
            .ToList();

        return new KpiValuesResponse(executive.Meta, _analytics.RuleSetVersion, values);
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

    private sealed class VolumeRow
    {
        public long Total { get; init; }
        public long Complaints { get; init; }
        public long NonComplaints { get; init; }
        public long Finished { get; init; }
        public long Unfinished { get; init; }
        public double? AvgResolutionDays { get; init; }
    }

    private sealed class DecisionCoverageRow
    {
        public long Eligible { get; init; }
        public long WithReply { get; init; }
        public long ComplaintEligible { get; init; }
        public long ComplaintWithReply { get; init; }
        public long GuidanceEligible { get; init; }
        public long GuidanceWithReply { get; init; }
        public long VoiceComplaintEligible { get; init; }
        public long ComplaintExVoiceEligible { get; init; }
        public long ComplaintExVoiceWithReply { get; init; }
        public long AutoComplaintEligible { get; init; }
        public long AutoComplaintWithReply { get; init; }
    }

    private sealed class VolumeTrendRow
    {
        public string? Label { get; init; }
        public long Requests { get; init; }
        public long Complaints { get; init; }
    }

    private sealed class OpenClosedTrendRow
    {
        public string? Label { get; init; }
        public long Requests { get; init; }
        public long Closed { get; init; }
    }
}
