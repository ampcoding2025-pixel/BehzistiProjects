using AiTicket.Api.Contracts;
using AiTicket.Api.Infrastructure.Analytics;
using AiTicket.Api.Infrastructure.Didban;
using AiTicket.Api.Modules.Analytics;
using Dapper;
using Microsoft.Extensions.Options;

namespace AiTicket.Api.Modules.Management;

public interface IManagementQueryService
{
    Task<ManagementOverviewResponse> GetOverviewAsync(PeriodFilter filter, CancellationToken ct);
    Task<ManagementDemandResponse> GetDemandAsync(PeriodFilter filter, CancellationToken ct);
    Task<ManagementResolutionResponse> GetResolutionAsync(PeriodFilter filter, CancellationToken ct);
    Task<ManagementBacklogResponse> GetBacklogAsync(PeriodFilter filter, CancellationToken ct);
    Task<ManagementProvincesResponse> GetProvincesAsync(PeriodFilter filter, CancellationToken ct);
    Task<ManagementQualityResponse> GetQualityAsync(PeriodFilter filter, CancellationToken ct);
    Task<ManagementCriticalResponse> GetCriticalAsync(PeriodFilter filter, CancellationToken ct);
}

public sealed class DidbanManagementQueryService(
    IDidbanConnectionFactory connectionFactory,
    IOptions<AnalyticsOptions> analyticsOptions,
    ILogger<DidbanManagementQueryService> logger) : IManagementQueryService
{
    private readonly AnalyticsOptions _analytics = analyticsOptions.Value;

    public async Task<ManagementOverviewResponse> GetOverviewAsync(PeriodFilter filter, CancellationToken ct)
    {
        await using var conn = await connectionFactory.OpenReadOnlyAsync(ct);
        var (whereSql, parameters) = BuildWhere(filter);
        var dp = ToDynamic(parameters);
        var prev = PreviousPeriod(filter);
        var (prevWhere, prevParams) = BuildWhere(prev);
        var prevDp = ToDynamic(prevParams);

        var cur = await QueryCore(conn, whereSql, dp, ct);
        var prior = await QueryCore(conn, prevWhere, prevDp, ct);

        var openNow = await conn.ExecuteScalarAsync<long>(
            new CommandDefinition(
                """
                SELECT COUNT_BIG(*) FROM dbo.Cookie c
                WHERE c.CookieTypeId = @cookieTypeId AND c.CookieFinishTime IS NULL
                """,
                new { cookieTypeId = _analytics.DefaultCookieTypeId },
                cancellationToken: ct));

        var cartable = await conn.ExecuteScalarAsync<long>(
            new CommandDefinition("SELECT COUNT_BIG(*) FROM dbo.Cartable", cancellationToken: ct));

        var trend = await QueryThroughput(conn, whereSql, dp, ct);
        var topics = await QueryTopicChanges(conn, whereSql, dp, prevWhere, prevDp, ct);
        var provinces = await QueryProvinceVolumes(conn, whereSql, dp, ct);

        var complaintShare = Pct(cur.Complaints, cur.Total);
        var prevComplaintShare = Pct(prior.Complaints, prior.Total);
        var finishRate = Pct(cur.Finished, cur.Total);
        var pursuitRate = Pct(cur.WithPursuits, cur.Total);

        var kpis = new List<MgmtKpiCardDto>
        {
            Card("inflow", "کل پرونده‌های ثبت‌شده", cur.Total, "count", null, null, prior.Total,
                Delta(cur.Total, prior.Total), "neutral",
                "تعداد پرونده‌های واجد شرایط با CookieTime در بازه", "واقعیت آماری"),
            Card("finished", "پرونده‌های خاتمه‌یافته", cur.Finished, "count", finishRate, "percent", prior.Finished,
                Delta(cur.Finished, prior.Finished), "positive",
                "دارای CookieFinishTime (خاتمه زمانی — نه لزوماً وضعیت مصوب)", "واقعیت آماری"),
            Card("open", "پرونده‌های باز", openNow, "count", null, null, null, null, "warning",
                $"بدون FinishTime در تاریخ مرجع · کارتابل≈{cartable:N0}", "نیازمند قاعده"),
            Card("complaint-share", "سهم شکایات", complaintShare, "percent", null, null, prevComplaintShare,
                Delta(complaintShare, prevComplaintShare), "neutral",
                "SubjectClass = شکایت ÷ کل واجد شرایط", "واقعیت آماری"),
            Card("median-days", "میانه زمان رسیدگی", cur.MedianDays, "days", null, null, prior.MedianDays,
                Delta(cur.MedianDays, prior.MedianDays), "warning",
                "میانه CookieTime تا FinishTime برای پرونده‌های دارای هر دو تاریخ", "واقعیت آماری"),
            Card("pursuits", "پرونده‌های دارای پیگیری", cur.WithPursuits, "count", pursuitRate, "percent", prior.WithPursuits,
                Delta(cur.WithPursuits, prior.WithPursuits), "neutral",
                "CookiePersuitsCount > 0", "واقعیت آماری"),
        };

        var alerts = BuildAlerts(cur, prior, topics, provinces, openNow, cartable);
        var priorities = BuildPriorities(topics, provinces, cur, openNow);

        logger.LogInformation("Management overview Total={Total} Open={Open}", cur.Total, openNow);

        return new ManagementOverviewResponse(
            new MetaDto("didban", DateTimeOffset.UtcNow, SqlFilterBuilder.PeriodLabel(filter),
                ["نسخه اول مدیریتی · خاتمه وضعیتی و SLA تا تأیید جدا نگه داشته شده‌اند"]),
            _analytics.RuleSetVersion,
            kpis,
            trend,
            topics.Take(5).ToList(),
            provinces.Take(5).ToList(),
            alerts,
            priorities,
            new MgmtMapMetricDto("cases", "حجم پرونده", provinces.Take(20).ToList()));
    }

    public async Task<ManagementDemandResponse> GetDemandAsync(PeriodFilter filter, CancellationToken ct)
    {
        await using var conn = await connectionFactory.OpenReadOnlyAsync(ct);
        var (whereSql, parameters) = BuildWhere(filter);
        var dp = ToDynamic(parameters);
        var prev = PreviousPeriod(filter);
        var (prevWhere, prevParams) = BuildWhere(prev);
        var prevDp = ToDynamic(prevParams);

        var trend = await QueryThroughput(conn, whereSql, dp, ct);
        var byClass = (await conn.QueryAsync<NamedValueDto>(new CommandDefinition(
            $"""
             SELECT sc.SubjectClassName AS Name, COUNT_BIG(*) AS Value
             FROM dbo.Cookie c
             INNER JOIN dbo.SubjectClass sc ON sc.SubjectClassId = c.SubjectClassId
             {whereSql}
             GROUP BY sc.SubjectClassName
             ORDER BY Value DESC
             """, dp, cancellationToken: ct))).ToList();

        var topics = await QueryTopicChanges(conn, whereSql, dp, prevWhere, prevDp, ct);
        var topSubjects = topics.Select(t => new NamedValueDto(t.Name, t.Count)).Take(12).ToList();

        return new ManagementDemandResponse(
            new MetaDto("didban", DateTimeOffset.UtcNow, SqlFilterBuilder.PeriodLabel(filter)),
            trend, byClass, topics.Take(15).ToList(), topSubjects);
    }

    public async Task<ManagementResolutionResponse> GetResolutionAsync(PeriodFilter filter, CancellationToken ct)
    {
        await using var conn = await connectionFactory.OpenReadOnlyAsync(ct);
        var (whereSql, parameters) = BuildWhere(filter);
        var dp = ToDynamic(parameters);
        var cur = await QueryCore(conn, whereSql, dp, ct);
        var trend = await QueryThroughput(conn, whereSql, dp, ct);

        var delayShare = await conn.QuerySingleAsync<DelayRow>(new CommandDefinition(
            $"""
             SELECT
               COUNT_BIG(*) AS FlowRows,
               SUM(CASE WHEN ISNULL(f.CookieFlowDelayTime,0) > 0 THEN 1 ELSE 0 END) AS DelayRows,
               AVG(CAST(steps.Cnt AS float)) AS AvgSteps
             FROM dbo.Cookie c
             INNER JOIN dbo.CookieFlow f ON f.CookieId = c.CookieId
             OUTER APPLY (SELECT COUNT_BIG(*) AS Cnt FROM dbo.CookieFlow fx WHERE fx.CookieId = c.CookieId) steps
             {whereSql}
             """, dp, cancellationToken: ct));

        var stepsDist = (await conn.QueryAsync<NamedValueDto>(new CommandDefinition(
            $"""
             SELECT
               CASE
                 WHEN x.Cnt <= 2 THEN N'۱–۲ مرحله'
                 WHEN x.Cnt <= 5 THEN N'۳–۵ مرحله'
                 WHEN x.Cnt <= 10 THEN N'۶–۱۰ مرحله'
                 ELSE N'بیش از ۱۰ مرحله'
               END AS Name,
               COUNT_BIG(*) AS Value
             FROM (
               SELECT c.CookieId, COUNT_BIG(f.CookieFlowId) AS Cnt
               FROM dbo.Cookie c
               LEFT JOIN dbo.CookieFlow f ON f.CookieId = c.CookieId
               {whereSql}
               GROUP BY c.CookieId
             ) x
             GROUP BY CASE
                 WHEN x.Cnt <= 2 THEN N'۱–۲ مرحله'
                 WHEN x.Cnt <= 5 THEN N'۳–۵ مرحله'
                 WHEN x.Cnt <= 10 THEN N'۶–۱۰ مرحله'
                 ELSE N'بیش از ۱۰ مرحله'
               END
             ORDER BY Value DESC
             """, dp, cancellationToken: ct))).ToList();

        var kpis = new List<MgmtKpiCardDto>
        {
            Card("finished-count", "خاتمه‌یافته زمانی", cur.Finished, "count", null, null, null, null, "positive",
                "FinishTime پر", "واقعیت آماری"),
            Card("finish-rate", "نرخ خاتمه زمانی", Pct(cur.Finished, cur.Total), "percent", null, null, null, null, "neutral",
                "Finished / Inflow cohort", "نیازمند قاعده"),
            Card("median", "میانه زمان رسیدگی", cur.MedianDays, "days", null, null, null, null, "warning",
                "Median(Finish−CookieTime)", "واقعیت آماری"),
            Card("p90", "صدک ۹۰ زمان رسیدگی", cur.P90Days, "days", null, null, null, null, "warning",
                "P90(Finish−CookieTime)", "واقعیت آماری"),
            Card("avg-steps", "میانگین مراحل گردش", delayShare.AvgSteps is null ? null : Math.Round(delayShare.AvgSteps.Value, 2), "ratio",
                null, null, null, null, "neutral", "Avg CookieFlow per Cookie", "واقعیت آماری"),
            Card("pursuit-rate", "نرخ پیگیری", Pct(cur.WithPursuits, cur.Total), "percent", null, null, null, null, "neutral",
                "حداقل یک پیگیری", "واقعیت آماری"),
            Card("delay-proxy", "نشانه تأخیر گردش کار",
                delayShare.FlowRows == 0 ? 0 : Pct(delayShare.DelayRows, delayShare.FlowRows), "percent",
                null, null, null, null, "warning",
                "سهم Flow با DelayTime>0", "نیازمند اعتبارسنجی"),
        };

        return new ManagementResolutionResponse(
            new MetaDto("didban", DateTimeOffset.UtcNow, SqlFilterBuilder.PeriodLabel(filter)),
            kpis, trend, stepsDist,
            "فیلدهای مهلت SLA خالی‌اند؛ شاخص رعایت SLA نمایش داده نمی‌شود.");
    }

    public async Task<ManagementBacklogResponse> GetBacklogAsync(PeriodFilter filter, CancellationToken ct)
    {
        await using var conn = await connectionFactory.OpenReadOnlyAsync(ct);
        var (whereSql, parameters) = BuildWhere(filter with { From = null, To = null }); // open stock uses type filter only
        // For age buckets use unfinished cookies (reference = now)
        var dp = ToDynamic(parameters);

        var age = await conn.QuerySingleAsync<AgeRow>(new CommandDefinition(
            """
            SELECT
              COUNT_BIG(*) AS OpenTotal,
              SUM(CASE WHEN DATEDIFF(day, c.CookieTime, GETDATE()) < 7 THEN 1 ELSE 0 END) AS D0_7,
              SUM(CASE WHEN DATEDIFF(day, c.CookieTime, GETDATE()) BETWEEN 7 AND 30 THEN 1 ELSE 0 END) AS D7_30,
              SUM(CASE WHEN DATEDIFF(day, c.CookieTime, GETDATE()) BETWEEN 31 AND 90 THEN 1 ELSE 0 END) AS D31_90,
              SUM(CASE WHEN DATEDIFF(day, c.CookieTime, GETDATE()) > 90 THEN 1 ELSE 0 END) AS D90p
            FROM dbo.Cookie c
            WHERE c.CookieTypeId = @cookieTypeId AND c.CookieFinishTime IS NULL
            """,
            new { cookieTypeId = _analytics.DefaultCookieTypeId },
            cancellationToken: ct));

        var units = (await conn.QueryAsync<UnitAgeRow>(new CommandDefinition(
            """
            SELECT TOP 15
              d.DepartmentName AS Name,
              COUNT_BIG(*) AS OpenCount,
              AVG(CAST(DATEDIFF(day, c.CookieTime, GETDATE()) AS float)) AS MedianAgeDays,
              SUM(CASE WHEN DATEDIFF(day, c.CookieTime, GETDATE()) > 90 THEN 1 ELSE 0 END) AS Over90
            FROM dbo.Cookie c
            INNER JOIN dbo.Department d ON d.DepartmentId = c.DepartmentId
            WHERE c.CookieTypeId = @cookieTypeId AND c.CookieFinishTime IS NULL
            GROUP BY d.DepartmentName
            ORDER BY OpenCount DESC
            """,
            new { cookieTypeId = _analytics.DefaultCookieTypeId },
            cancellationToken: ct))).ToList();

        var (tw, tp) = BuildWhere(filter);
        var trend = await QueryThroughput(conn, tw, ToDynamic(tp), ct);

        var kpis = new List<MgmtKpiCardDto>
        {
            Card("open-total", "پرونده باز (تاریخ مرجع)", age.OpenTotal, "count", null, null, null, null, "warning",
                "FinishTime IS NULL — تا تأیید قواعد وضعیت", "نیازمند قاعده"),
            Card("age-lt7", "کمتر از ۷ روز", age.D0_7, "count", null, null, null, null, "neutral", "سن از CookieTime", "واقعیت آماری"),
            Card("age-7-30", "۷ تا ۳۰ روز", age.D7_30, "count", null, null, null, null, "neutral", "سن از CookieTime", "واقعیت آماری"),
            Card("age-30-90", "۳۰ تا ۹۰ روز", age.D31_90, "count", null, null, null, null, "warning", "سن از CookieTime", "واقعیت آماری"),
            Card("age-90p", "بیش از ۹۰ روز", age.D90p, "count", null, null, null, null, "danger", "پرونده‌های قدیمی", "واقعیت آماری"),
        };

        var ageBuckets = new List<NamedValueDto>
        {
            new("کمتر از ۷ روز", age.D0_7),
            new("۷ تا ۳۰ روز", age.D7_30),
            new("۳۰ تا ۹۰ روز", age.D31_90),
            new("بیش از ۹۰ روز", age.D90p),
        };

        var unitRows = units.Select(u => new MgmtUnitBacklogDto(
            u.Name ?? "—",
            u.OpenCount,
            u.MedianAgeDays is null ? null : Math.Round(u.MedianAgeDays.Value, 1),
            u.Over90,
            "stable")).ToList();

        return new ManagementBacklogResponse(
            new MetaDto("didban", DateTimeOffset.UtcNow, "تاریخ مرجع: اکنون (FinishTime خالی)"),
            kpis, ageBuckets, unitRows, trend);
    }

    public async Task<ManagementProvincesResponse> GetProvincesAsync(PeriodFilter filter, CancellationToken ct)
    {
        await using var conn = await connectionFactory.OpenReadOnlyAsync(ct);
        var (whereSql, parameters) = BuildWhere(filter);
        var dp = ToDynamic(parameters);

        var rows = (await conn.QueryAsync<ProvinceAggRow>(new CommandDefinition(
            $"""
             SELECT
               r.RegionId AS Id,
               r.RegionName AS Name,
               COUNT_BIG(*) AS Cases,
               SUM(CASE WHEN c.SubjectClassId = 1 THEN 1 ELSE 0 END) AS Complaints,
               SUM(CASE WHEN c.CookieFinishTime IS NOT NULL THEN 1 ELSE 0 END) AS Finished,
               SUM(CASE WHEN c.CookieFinishTime IS NULL THEN 1 ELSE 0 END) AS OpenCount,
               SUM(CASE WHEN ISNULL(c.CookiePersuitsCount,0) > 0 THEN 1 ELSE 0 END) AS WithPursuits,
               AVG(CASE WHEN c.CookieFinishTime IS NOT NULL
                        THEN CAST(DATEDIFF(day, c.CookieTime, c.CookieFinishTime) AS float) END) AS MedianDays
             FROM dbo.Cookie c
             INNER JOIN dbo.Inform i ON i.CookieId = c.CookieId
             INNER JOIN dbo.Region r ON r.RegionId = i.RegionId
             {whereSql}
             GROUP BY r.RegionId, r.RegionName
             ORDER BY Cases DESC
             """, dp, cancellationToken: ct))).ToList();

        var provinces = rows.Select(r => new MgmtProvinceRowDto(
            r.Id,
            r.Name ?? "—",
            r.Cases,
            Pct(r.Complaints, r.Cases),
            Pct(r.Finished, r.Cases),
            r.MedianDays is null ? null : Math.Round(r.MedianDays.Value, 1),
            r.OpenCount,
            Pct(r.WithPursuits, r.Cases))).ToList();

        var trend = (await QueryThroughput(conn, whereSql, dp, ct))
            .Select(t => new NamedValueDto(t.Label, t.Inflow)).ToList();

        return new ManagementProvincesResponse(
            new MetaDto("didban", DateTimeOffset.UtcNow, SqlFilterBuilder.PeriodLabel(filter),
                ["مقایسه بر اساس تعداد و سهم — مخرج جمعیتی در این نسخه موجود نیست"]),
            provinces, trend);
    }

    public async Task<ManagementQualityResponse> GetQualityAsync(PeriodFilter filter, CancellationToken ct)
    {
        await using var conn = await connectionFactory.OpenReadOnlyAsync(ct);
        var (whereSql, parameters) = BuildWhere(filter);
        var dp = ToDynamic(parameters);

        var q = await conn.QuerySingleAsync<QualityRow>(new CommandDefinition(
            $"""
             SELECT
               COUNT_BIG(*) AS Total,
               SUM(CASE WHEN c.CookieFinishTime IS NOT NULL THEN 1 ELSE 0 END) AS FinishFilled,
               SUM(CASE WHEN c.SubjectId IS NOT NULL THEN 1 ELSE 0 END) AS SubjectFilled,
               SUM(CASE WHEN i.RegionId IS NOT NULL THEN 1 ELSE 0 END) AS RegionFilled,
               SUM(CASE WHEN i.AreaId IS NOT NULL THEN 1 ELSE 0 END) AS AreaFilled,
               SUM(CASE WHEN c.CookieDeadlineTime IS NOT NULL THEN 1 ELSE 0 END) AS DeadlineFilled,
               COUNT_BIG(replied.CookieId) AS WithReply
             FROM dbo.Cookie c
             LEFT JOIN dbo.Inform i ON i.CookieId = c.CookieId
             LEFT JOIN (
               SELECT DISTINCT f.CookieId FROM dbo.CookieFlow f
               WHERE f.CookieFlowReplyCitizen IS NOT NULL AND LEN(LTRIM(RTRIM(f.CookieFlowReplyCitizen))) > 0
             ) replied ON replied.CookieId = c.CookieId
             {whereSql}
             """, dp, cancellationToken: ct));

        var metrics = new List<MgmtQualityMetricDto>
        {
            Q("finish", "تکمیل تاریخ خاتمه", Pct(q.FinishFilled, q.Total), "ok", "FinishTime"),
            Q("subject", "تکمیل موضوع", Pct(q.SubjectFilled, q.Total), "ok", "SubjectId"),
            Q("region", "تکمیل استان", Pct(q.RegionFilled, q.Total), "ok", "Inform.RegionId"),
            Q("area", "تکمیل شهرستان/منطقه", Pct(q.AreaFilled, q.Total), "warn", "Inform.AreaId"),
            Q("geo-coords", "پوشش مختصات مکانی", null, "limited", "lat/long پراکنده — نقشه بر اساس استان"),
            Q("citizen-reply", "پوشش پاسخ شهروندی قابل مشاهده", Pct(q.WithReply, q.Total), "limited", "نباید معادل کیفیت پاسخ تلقی شود"),
            Q("sla", "مهلت رسمی SLA", Pct(q.DeadlineFilled, q.Total), "unavailable", "ستون Deadline خالی است"),
            Q("rules", "نسخه قواعد محاسباتی", null, "ok", _analytics.RuleSetVersion),
        };

        var alerts = new List<MgmtAlertDto>
        {
            new("q1", "SLA رسمی قابل محاسبه نیست", "کل سامانه", "شاخص رعایت مهلت نمایش داده نمی‌شود",
                "تعریف SLA و تقویم کاری را مصوب کنید", "warning"),
            new("q2", "خاتمه وضعیتی از خاتمه زمانی جداست", "تعاریف KPI", "تا تأیید مجموعه وضعیت‌های نهایی ادغام نشوند",
                "کارگاه وضعیت‌های بسته را برگزار کنید", "info"),
            new("q3", "پوشش پاسخ شهروندی محدود است", "دانش تاریخی", $"≈{Pct(q.WithReply, q.Total)}٪",
                "برای تصمیم از D1 تفکیک‌شده استفاده کنید", "warning"),
        };

        var defs = new List<string>
        {
            "واجد شرایط: CookieTypeId=پیام + فیلتر بازه/استان/طبقه",
            "خاتمه‌یافته زمانی: CookieFinishTime IS NOT NULL",
            "باز (موقت): CookieFinishTime IS NULL در تاریخ مرجع",
            "پیگیری: CookiePersuitsCount > 0",
            "نشانه تأخیر: CookieFlowDelayTime > 0 (جانشین SLA)",
            "دوره مقایسه: بازه هم‌طول بلافاصله قبل از بازه انتخابی",
            $"ruleSetVersion: {_analytics.RuleSetVersion}",
        };

        return new ManagementQualityResponse(
            new MetaDto("didban", DateTimeOffset.UtcNow, SqlFilterBuilder.PeriodLabel(filter)),
            _analytics.RuleSetVersion, metrics, defs, alerts);
    }

    public async Task<ManagementCriticalResponse> GetCriticalAsync(PeriodFilter filter, CancellationToken ct)
    {
        await using var conn = await connectionFactory.OpenReadOnlyAsync(ct);
        var (whereSql, parameters) = BuildWhere(filter);
        var dp = ToDynamic(parameters);
        var prev = PreviousPeriod(filter);
        var (prevWhere, prevParams) = BuildWhere(prev);
        var topics = await QueryTopicChanges(conn, whereSql, dp, prevWhere, ToDynamic(prevParams), ct);

        var issues = topics
            .Where(t => t.DeltaPercent is not null && Math.Abs(t.DeltaPercent.Value) >= 15)
            .OrderByDescending(t => Math.Abs(t.DeltaPercent ?? 0) * Math.Log10(Math.Max(10, t.Count)))
            .Take(10)
            .ToList();

        var steps = new List<string>
        {
            "شناسایی افزایش یا تغییر غیرعادی",
            "بررسی موضوعات تشکیل‌دهنده تغییر",
            "بررسی تمرکز جغرافیایی",
            "بررسی واحدهای سازمانی مرتبط",
            "بررسی مرحله یا مراحل گردش کار",
            "بررسی زمان رسیدگی و پیگیری‌ها",
            "ارائه شواهد و فرضیه‌های قابل بررسی",
        };

        var hypotheses = issues.Take(5).Select((t, i) => new MgmtAlertDto(
            $"h{i + 1}",
            $"تغییر {t.DeltaPercent:0.#}٪ در «{t.Name}»",
            "موضوع / احتمالاً چند استان",
            $"حجم فعلی {t.Count:N0} · سهم {t.SharePercent:0.#}٪",
            "فرضیه: نیازمند بررسی کارشناسی — هم‌زمانی به‌معنای علت قطعی نیست",
            t.Priority == "high" ? "warning" : "info")).ToList();

        return new ManagementCriticalResponse(
            new MetaDto("didban", DateTimeOffset.UtcNow, SqlFilterBuilder.PeriodLabel(filter),
                ["برچسب‌ها: واقعیت آماری / ارتباط مشاهده‌شده / فرضیه — علت تأییدشده فقط پس از کارشناسی"]),
            issues.Count > 0 ? issues : topics.Take(8).ToList(),
            steps,
            hypotheses);
    }

    // ---- helpers ----

    private (string Sql, Dictionary<string, object?> Parameters) BuildWhere(PeriodFilter filter)
    {
        var (sql, p) = SqlFilterBuilder.BuildCookieWhere(filter, _analytics.DefaultCookieTypeId);
        if (filter.RegionId is not null)
        {
            sql += """
                 AND EXISTS (
                   SELECT 1 FROM dbo.Inform ix
                   WHERE ix.CookieId = c.CookieId AND ix.RegionId = @regionId)
                """;
            p["regionId"] = filter.RegionId.Value;
        }
        return (sql, p);
    }

    private static PeriodFilter PreviousPeriod(PeriodFilter filter)
    {
        if (filter.From is null || filter.To is null)
        {
            return filter with { From = null, To = null };
        }
        var span = filter.To.Value.Date - filter.From.Value.Date;
        var prevTo = filter.From.Value.Date;
        var prevFrom = prevTo - span;
        return filter with { From = prevFrom, To = prevTo };
    }

    private async Task<CoreRow> QueryCore(System.Data.IDbConnection conn, string whereSql, DynamicParameters dp, CancellationToken ct)
    {
        // Median/P90 via ordered sample of duration days (SQL Server 2016-compatible).
        var core = await conn.QuerySingleAsync<CoreRow>(new CommandDefinition(
            $"""
             SELECT
               COUNT_BIG(*) AS Total,
               SUM(CASE WHEN c.SubjectClassId = 1 THEN 1 ELSE 0 END) AS Complaints,
               SUM(CASE WHEN c.CookieFinishTime IS NOT NULL THEN 1 ELSE 0 END) AS Finished,
               SUM(CASE WHEN ISNULL(c.CookiePersuitsCount,0) > 0 THEN 1 ELSE 0 END) AS WithPursuits,
               AVG(CASE WHEN c.CookieFinishTime IS NOT NULL
                        THEN CAST(DATEDIFF(day, c.CookieTime, c.CookieFinishTime) AS float) END) AS MedianDays,
               CAST(NULL AS float) AS P90Days
             FROM dbo.Cookie c
             {whereSql}
             """, dp, cancellationToken: ct));

        var durations = (await conn.QueryAsync<double>(new CommandDefinition(
            $"""
             SELECT TOP 5000 CAST(DATEDIFF(day, c.CookieTime, c.CookieFinishTime) AS float) AS Days
             FROM dbo.Cookie c
             {whereSql}
               AND c.CookieFinishTime IS NOT NULL
             ORDER BY c.CookieFinishTime DESC
             """, dp, cancellationToken: ct))).OrderBy(x => x).ToList();

        double? median = null;
        double? p90 = null;
        if (durations.Count > 0)
        {
            median = durations[durations.Count / 2];
            p90 = durations[(int)Math.Min(durations.Count - 1, Math.Floor(durations.Count * 0.9))];
        }

        return new CoreRow
        {
            Total = core.Total,
            Complaints = core.Complaints,
            Finished = core.Finished,
            WithPursuits = core.WithPursuits,
            MedianDays = median,
            P90Days = p90
        };
    }

    private async Task<List<MgmtThroughputPointDto>> QueryThroughput(
        System.Data.IDbConnection conn, string whereSql, DynamicParameters dp, CancellationToken ct)
    {
        var rows = (await conn.QueryAsync<ThroughputRow>(new CommandDefinition(
            $"""
             SELECT
               CONCAT(CAST(YEAR(c.CookieTime) AS nvarchar(4)), N'/', RIGHT(CONCAT(N'0', CAST(MONTH(c.CookieTime) AS nvarchar(2))), 2)) AS Label,
               COUNT_BIG(*) AS Inflow,
               SUM(CASE WHEN c.CookieFinishTime IS NOT NULL THEN 1 ELSE 0 END) AS Finished
             FROM dbo.Cookie c
             {whereSql}
             GROUP BY YEAR(c.CookieTime), MONTH(c.CookieTime)
             ORDER BY YEAR(c.CookieTime), MONTH(c.CookieTime)
             """, dp, cancellationToken: ct))).ToList();

        return rows.Select(r => new MgmtThroughputPointDto(
            r.Label ?? "",
            r.Inflow,
            r.Finished,
            r.Inflow - r.Finished)).ToList();
    }

    private async Task<List<MgmtTopicChangeDto>> QueryTopicChanges(
        System.Data.IDbConnection conn,
        string whereSql,
        DynamicParameters dp,
        string prevWhere,
        DynamicParameters prevDp,
        CancellationToken ct)
    {
        var cur = (await conn.QueryAsync<TopicRow>(new CommandDefinition(
            $"""
             SELECT TOP 40 CAST(s.SubjectId AS nvarchar(20)) AS Id, s.SubjectName AS Name, COUNT_BIG(*) AS Count
             FROM dbo.Cookie c
             INNER JOIN dbo.Subject s ON s.SubjectId = c.SubjectId
             {whereSql}
             GROUP BY s.SubjectId, s.SubjectName
             ORDER BY Count DESC
             """, dp, cancellationToken: ct))).ToList();

        var prev = (await conn.QueryAsync<TopicRow>(new CommandDefinition(
            $"""
             SELECT CAST(s.SubjectId AS nvarchar(20)) AS Id, s.SubjectName AS Name, COUNT_BIG(*) AS Count
             FROM dbo.Cookie c
             INNER JOIN dbo.Subject s ON s.SubjectId = c.SubjectId
             {prevWhere}
             GROUP BY s.SubjectId, s.SubjectName
             """, prevDp, cancellationToken: ct))).ToDictionary(x => x.Id ?? "", x => x.Count, StringComparer.OrdinalIgnoreCase);

        var total = cur.Sum(x => x.Count);
        return cur.Select(t =>
        {
            var prevCount = prev.TryGetValue(t.Id ?? "", out var p) ? p : 0L;
            var delta = prevCount == 0 ? (t.Count > 0 ? 100 : 0) : Math.Round(100.0 * (t.Count - prevCount) / prevCount, 1);
            var trend = delta >= 15 ? "up" : delta <= -15 ? "down" : "stable";
            var priority = Math.Abs(delta) >= 25 && t.Count >= 100 ? "high" : Math.Abs(delta) >= 15 ? "medium" : "low";
            return new MgmtTopicChangeDto(
                t.Id ?? "",
                t.Name ?? "—",
                t.Count,
                Pct(t.Count, total),
                delta,
                trend,
                priority);
        }).OrderByDescending(t => Math.Abs(t.DeltaPercent ?? 0) * Math.Log10(Math.Max(10, t.Count)))
          .ToList();
    }

    private async Task<List<NamedValueDto>> QueryProvinceVolumes(
        System.Data.IDbConnection conn, string whereSql, DynamicParameters dp, CancellationToken ct)
    {
        return (await conn.QueryAsync<NamedValueDto>(new CommandDefinition(
            $"""
             SELECT TOP 20 r.RegionName AS Name, COUNT_BIG(*) AS Value
             FROM dbo.Cookie c
             INNER JOIN dbo.Inform i ON i.CookieId = c.CookieId
             INNER JOIN dbo.Region r ON r.RegionId = i.RegionId
             {whereSql}
             GROUP BY r.RegionName
             ORDER BY Value DESC
             """, dp, cancellationToken: ct))).ToList();
    }

    private static List<MgmtAlertDto> BuildAlerts(
        CoreRow cur, CoreRow prior, List<MgmtTopicChangeDto> topics, List<NamedValueDto> provinces, long openNow, long cartable)
    {
        var list = new List<MgmtAlertDto>();
        var topUp = topics.FirstOrDefault(t => t.Trend == "up");
        if (topUp is not null)
        {
            list.Add(new("a1",
                $"افزایش {topUp.DeltaPercent:0.#}٪ در موضوع «{topUp.Name}»",
                "موضوع پرتغییر",
                $"حجم {topUp.Count:N0} · سهم {topUp.SharePercent:0.#}٪",
                "بررسی استان‌ها و واحدهای مرتبط با این موضوع", "warning"));
        }
        if (openNow > 0)
        {
            list.Add(new("a2",
                "انباشت پرونده‌های بدون FinishTime",
                "کل سازمان",
                $"≈{openNow:N0} باز · کارتابل≈{cartable:N0}",
                "مرور واحدهای پرتراکم در صفحه پرونده‌های باز", "warning"));
        }
        var finishDelta = Delta(cur.Finished, prior.Finished);
        if (finishDelta is < -10)
        {
            list.Add(new("a3",
                $"کاهش خاتمه‌یافتگی نسبت به دوره قبل ({finishDelta:0.#}٪)",
                "عملکرد رسیدگی",
                $"خاتمه فعلی {cur.Finished:N0}",
                "مقایسه ورودی/خروجی ماهانه و واحدهای کند", "danger"));
        }
        var pursuitDelta = Delta(cur.WithPursuits, prior.WithPursuits);
        if (pursuitDelta is > 15)
        {
            list.Add(new("a4",
                $"رشد پرونده‌های دارای پیگیری ({pursuitDelta:0.#}٪)",
                "پیگیری",
                $"{cur.WithPursuits:N0} پرونده",
                "بررسی موضوعات با شدت پیگیری بالا", "info"));
        }
        if (provinces.Count > 0)
        {
            var top = provinces[0];
            var share = provinces.Sum(p => p.Value) == 0 ? 0 : 100.0 * top.Value / provinces.Sum(p => p.Value);
            if (share >= 20)
            {
                list.Add(new("a5",
                    "تمرکز نامتوازن پرونده‌ها در یک استان",
                    top.Name,
                    $"≈{share:0.#}٪ از نمونه استان‌های برتر",
                    "مقایسه با میانگین کشوری در صفحه استانی", "warning"));
            }
        }
        return list;
    }

    private static List<MgmtPriorityDto> BuildPriorities(
        List<MgmtTopicChangeDto> topics, List<NamedValueDto> provinces, CoreRow cur, long openNow)
    {
        var list = new List<MgmtPriorityDto>();
        foreach (var t in topics.Where(x => x.Priority == "high").Take(2))
        {
            list.Add(new($"p-{t.Id}", $"پایش موضوع پرتغییر: {t.Name}",
                $"Δ {t.DeltaPercent:0.#}٪ · n={t.Count:N0}",
                "موضوع سراسری", t.Trend == "up" ? "افایشی" : "کاهشی",
                "بررسی شواهد در صفحه موضوعات بحرانی"));
        }
        if (openNow > 20000)
        {
            list.Add(new("p-open", "کاهش انباشت پرونده‌های باز",
                $"≈{openNow:N0} بدون FinishTime",
                "واحدهای پرتراکم", "پایدار/نگران‌کننده",
                "اولویت‌بندی پرونده‌های >۹۰ روز"));
        }
        if (provinces.Count > 0)
        {
            list.Add(new("p-geo", $"تمرکز جغرافیایی: {provinces[0].Name}",
                $"حجم {provinces[0].Value:N0}",
                provinces[0].Name, "تمرکز بالا",
                "مقایسه سهم شکایت و زمان رسیدگی استان"));
        }
        if (cur.MedianDays is >= 30)
        {
            list.Add(new("p-time", "کاهش میانه زمان رسیدگی",
                $"میانه ≈ {cur.MedianDays:0.#} روز",
                "فرایند رسیدگی", "کند",
                "تحلیل مراحل پرتکرار CookieFlow"));
        }
        return list.Take(5).ToList();
    }

    private static MgmtKpiCardDto Card(
        string id, string label, double? value, string unit,
        double? secondary, string? secondaryUnit,
        double? previous, double? delta, string tone,
        string definition, string confidence) =>
        new(id, label, value is null ? null : Math.Round(value.Value, unit is "days" or "percent" or "ratio" ? 1 : 0),
            unit, secondary, secondaryUnit, previous, delta, tone, definition, confidence);

    private static MgmtQualityMetricDto Q(string id, string label, double? fill, string status, string note) =>
        new(id, label, fill, status, note);

    private static double Pct(long n, long d) => d == 0 ? 0 : Math.Round(100.0 * n / d, 1);
    private static double? Delta(double? cur, double? prev)
    {
        if (cur is null || prev is null || prev == 0) return null;
        return Math.Round(100.0 * (cur.Value - prev.Value) / prev.Value, 1);
    }

    private static DynamicParameters ToDynamic(Dictionary<string, object?> parameters)
    {
        var dp = new DynamicParameters();
        foreach (var (k, v) in parameters) dp.Add(k, v);
        return dp;
    }

    private sealed class CoreRow
    {
        public long Total { get; init; }
        public long Complaints { get; init; }
        public long Finished { get; init; }
        public long WithPursuits { get; init; }
        public double? MedianDays { get; init; }
        public double? P90Days { get; init; }
    }

    private sealed class ThroughputRow
    {
        public string? Label { get; init; }
        public long Inflow { get; init; }
        public long Finished { get; init; }
    }

    private sealed class TopicRow
    {
        public string? Id { get; init; }
        public string? Name { get; init; }
        public long Count { get; init; }
    }

    private sealed class DelayRow
    {
        public long FlowRows { get; init; }
        public long DelayRows { get; init; }
        public double? AvgSteps { get; init; }
    }

    private sealed class AgeRow
    {
        public long OpenTotal { get; init; }
        public long D0_7 { get; init; }
        public long D7_30 { get; init; }
        public long D31_90 { get; init; }
        public long D90p { get; init; }
    }

    private sealed class UnitAgeRow
    {
        public string? Name { get; init; }
        public long OpenCount { get; init; }
        public double? MedianAgeDays { get; init; }
        public long Over90 { get; init; }
    }

    private sealed class ProvinceAggRow
    {
        public int Id { get; init; }
        public string? Name { get; init; }
        public long Cases { get; init; }
        public long Complaints { get; init; }
        public long Finished { get; init; }
        public long OpenCount { get; init; }
        public long WithPursuits { get; init; }
        public double? MedianDays { get; init; }
    }

    private sealed class QualityRow
    {
        public long Total { get; init; }
        public long FinishFilled { get; init; }
        public long SubjectFilled { get; init; }
        public long RegionFilled { get; init; }
        public long AreaFilled { get; init; }
        public long DeadlineFilled { get; init; }
        public long WithReply { get; init; }
    }
}
