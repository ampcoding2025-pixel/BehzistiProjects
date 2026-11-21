using AiTicket.Api.Contracts;
using Dapper;

namespace AiTicket.Api.Modules.Analytics;

public sealed partial class DidbanAnalyticsQueryService
{
    public async Task<UserRateTrendResponse> GetUserRateTrendAsync(
        PeriodFilter filter,
        int userId,
        string role,
        CancellationToken ct)
    {
        var normalizedRole = NormalizeRole(role);
        await using var connection = await connectionFactory.OpenReadOnlyAsync(ct);

        // Strip person filters — this query is for one explicit userId+role
        var baseFilter = filter with
        {
            FlowUserId = null,
            ReferUserId = null,
            CartableUserId = null,
            CallUserId = null,
            CaseUserId = null,
        };

        var toDate = (baseFilter.To ?? DateTime.Today).Date;
        var fromDate = (baseFilter.From ?? toDate.AddMonths(-5)).Date;
        // Always show enough months for a readable curve
        if (toDate.AddMonths(-5) < fromDate)
            fromDate = toDate.AddMonths(-5);

        var windowFilter = baseFilter with { From = fromDate, To = toDate };
        var (whereSql, parameters) = SqlFilterBuilder.BuildCookieWhere(windowFilter, _analytics.DefaultCookieTypeId);
        parameters["userId"] = userId;
        var dp = ToDynamic(parameters);

        var (joinSql, userPredicate, avgExpr) = RoleSql(normalizedRole);

        var rows = (await connection.QueryAsync<UserRateMonthRow>(
            new CommandDefinition(
                $"""
                SELECT
                  CONCAT(
                    CAST(YEAR(c.CookieTime) AS nvarchar(4)),
                    N'/',
                    RIGHT(CONCAT(N'0', CAST(MONTH(c.CookieTime) AS nvarchar(2))), 2)
                  ) AS Label,
                  COUNT_BIG(*) AS Load,
                  AVG({avgExpr}) AS AvgHours
                FROM dbo.Cookie c
                {joinSql}
                {whereSql}
                  AND {userPredicate}
                GROUP BY YEAR(c.CookieTime), MONTH(c.CookieTime)
                ORDER BY YEAR(c.CookieTime), MONTH(c.CookieTime)
                """,
                dp,
                cancellationToken: ct))).ToList();

        var points = rows.Select(r =>
        {
            double? rate = null;
            // Floor tiny averages so same-minute finishes don't explode rate
            if (r.AvgHours is > 0)
            {
                var hours = Math.Max(r.AvgHours.Value, 1.0 / 60.0);
                rate = r.Load / hours;
            }
            return new UserRatePointDto(r.Label ?? "", r.Load, r.AvgHours, rate);
        }).ToList();

        var name = await connection.ExecuteScalarAsync<string?>(
            new CommandDefinition(
                """
                SELECT TOP 1
                  COALESCE(
                    NULLIF(LTRIM(RTRIM(CONCAT(ISNULL(UserFirstName, N''), N' ', ISNULL(UserLastName, N'')))), N''),
                    UserName,
                    N'کاربر ' + CAST(UserId AS nvarchar(20)))
                FROM dbo.UserInfo WHERE UserId = @userId
                """,
                new { userId },
                cancellationToken: ct));

        return new UserRateTrendResponse(
            new MetaDto(
                "didban",
                DateTimeOffset.UtcNow,
                SqlFilterBuilder.PeriodLabel(windowFilter with { From = fromDate, To = toDate })),
            userId,
            normalizedRole,
            name ?? $"کاربر {userId}",
            "نرخ = حجم ÷ میانگین ساعت (بار کاری بر واحد زمان)",
            points);
    }

    private static string NormalizeRole(string role) =>
        role.Trim().ToLowerInvariant() switch
        {
            "flowactor" or "flow" or "flowuser" => "flowActor",
            "referuser" or "refer" or "referred" => "referUser",
            "cartableuser" or "cartable" => "cartableUser",
            "calluser" or "call" => "callUser",
            "caseuser" or "case" => "caseUser",
            _ => "flowActor",
        };

    private static (string JoinSql, string UserPredicate, string AvgExpr) RoleSql(string role) =>
        role switch
        {
            "referUser" => (
                "INNER JOIN dbo.CookieFlow f ON f.CookieId = c.CookieId",
                "COALESCE(f.ReferToUserId, f.CookieFlowVisitedUserId) = @userId",
                """
                CASE
                  WHEN f.CookieFlowFinishTime IS NOT NULL AND f.CookieFlowTime IS NOT NULL
                   AND f.CookieFlowFinishTime >= f.CookieFlowTime
                  THEN CAST(DATEDIFF(hour, f.CookieFlowTime, f.CookieFlowFinishTime) AS float)
                END
                """),
            "cartableUser" => (
                "INNER JOIN dbo.Cartable ct ON ct.CookieId = c.CookieId",
                "ct.CartableUserId = @userId",
                """
                CASE
                  WHEN ct.CartableTime IS NOT NULL
                  THEN CAST(DATEDIFF(hour, ct.CartableTime, COALESCE(ct.CartableFinishTime, GETDATE())) AS float)
                END
                """),
            "callUser" => (
                "INNER JOIN dbo.CallRecord cr ON cr.CookieId = c.CookieId",
                "cr.UserId = @userId",
                """
                CASE
                  WHEN c.CookieTime IS NOT NULL
                  THEN CAST(DATEDIFF(hour, c.CookieTime, COALESCE(c.CookieFinishTime, GETDATE())) AS float)
                END
                """),
            "caseUser" => (
                "",
                "COALESCE(c.CookieUserId, c.UserId) = @userId",
                """
                CASE
                  WHEN c.CookieTime IS NOT NULL
                  THEN CAST(DATEDIFF(hour, c.CookieTime, COALESCE(c.CookieFinishTime, GETDATE())) AS float)
                END
                """),
            _ => (
                "INNER JOIN dbo.CookieFlow f ON f.CookieId = c.CookieId",
                "COALESCE(f.CookieFlowUserId, f.UserId, f.InsertUserId) = @userId",
                """
                CASE
                  WHEN f.CookieFlowFinishTime IS NOT NULL AND f.CookieFlowTime IS NOT NULL
                   AND f.CookieFlowFinishTime >= f.CookieFlowTime
                  THEN CAST(DATEDIFF(hour, f.CookieFlowTime, f.CookieFlowFinishTime) AS float)
                END
                """),
        };

    private sealed class UserRateMonthRow
    {
        public string? Label { get; init; }
        public long Load { get; init; }
        public double? AvgHours { get; init; }
    }
}
