using AiTicket.Api.Contracts;
using Dapper;

namespace AiTicket.Api.Modules.Analytics;

public sealed partial class DidbanAnalyticsQueryService
{
    public async Task<UserRequestsResponse> GetUserRequestsAsync(
        PeriodFilter filter,
        int userId,
        string role,
        CancellationToken ct)
    {
        var normalizedRole = NormalizeRole(role);
        await using var connection = await connectionFactory.OpenReadOnlyAsync(ct);

        var baseFilter = filter with
        {
            FlowUserId = null,
            ReferUserId = null,
            CartableUserId = null,
            CallUserId = null,
            CaseUserId = null,
        };

        var (whereSql, parameters) = SqlFilterBuilder.BuildCookieWhere(baseFilter, _analytics.DefaultCookieTypeId);
        parameters["userId"] = userId;
        var dp = ToDynamic(parameters);

        var (joinSql, userPredicate, startExpr, finishExpr, stepJoin, stepNameExpr) =
            RequestDetailSql(normalizedRole);

        var hoursExpr = $"""
            CASE
              WHEN ({startExpr}) IS NOT NULL
               AND COALESCE(({finishExpr}), GETDATE()) >= ({startExpr})
              THEN CAST(DATEDIFF(hour, ({startExpr}), COALESCE(({finishExpr}), GETDATE())) AS float)
            END
            """;

        // مدت = عمر پرونده در سیستم (CookieTime → Finish/now)
        // باز/بسته = سطح پرونده (CookieFinishTime)، نه اتمام کارِ همان نقش
        var lifetimeHoursExpr = """
            CASE
              WHEN c.CookieTime IS NOT NULL
               AND COALESCE(c.CookieFinishTime, GETDATE()) >= c.CookieTime
              THEN CAST(DATEDIFF(hour, c.CookieTime, COALESCE(c.CookieFinishTime, GETDATE())) AS float)
            END
            """;

        var items = (await connection.QueryAsync<UserRequestItemDto>(
            new CommandDefinition(
                $"""
                SELECT TOP 400
                  c.CookieId AS CookieId,
                  COALESCE(
                    NULLIF(LTRIM(RTRIM(sj.SubjectName)), N''),
                    N'پرونده ' + CAST(c.CookieId AS nvarchar(20))
                  ) AS Subject,
                  COALESCE({stepNameExpr}, N'نامشخص') AS StepName,
                  {lifetimeHoursExpr} AS Hours,
                  CASE WHEN c.CookieFinishTime IS NULL THEN CAST(1 AS bit) ELSE CAST(0 AS bit) END AS IsOpen,
                  c.CookieTime AS StartTime,
                  c.CookieFinishTime AS FinishTime
                FROM dbo.Cookie c
                {joinSql}
                {stepJoin}
                LEFT JOIN dbo.Subject sj ON sj.SubjectId = c.SubjectId
                {whereSql}
                  AND {userPredicate}
                  AND ({startExpr}) IS NOT NULL
                ORDER BY c.CookieTime DESC
                """,
                dp,
                commandTimeout: _didban.CommandTimeoutSeconds,
                cancellationToken: ct))).ToList();

        var stepHoursOpen = (await connection.QueryAsync<NamedDoubleValueDto>(
            new CommandDefinition(
                $"""
                SELECT
                  COALESCE({stepNameExpr}, N'نامشخص') AS Name,
                  CAST(SUM({hoursExpr}) AS float) AS Value
                FROM dbo.Cookie c
                {joinSql}
                {stepJoin}
                {whereSql}
                  AND {userPredicate}
                  AND ({startExpr}) IS NOT NULL
                  AND ({finishExpr}) IS NULL
                GROUP BY COALESCE({stepNameExpr}, N'نامشخص')
                ORDER BY Value DESC
                """,
                dp,
                commandTimeout: _didban.CommandTimeoutSeconds,
                cancellationToken: ct))).ToList();

        var stepHoursClosed = (await connection.QueryAsync<NamedDoubleValueDto>(
            new CommandDefinition(
                $"""
                SELECT
                  COALESCE({stepNameExpr}, N'نامشخص') AS Name,
                  CAST(SUM({hoursExpr}) AS float) AS Value
                FROM dbo.Cookie c
                {joinSql}
                {stepJoin}
                {whereSql}
                  AND {userPredicate}
                  AND ({startExpr}) IS NOT NULL
                  AND ({finishExpr}) IS NOT NULL
                GROUP BY COALESCE({stepNameExpr}, N'نامشخص')
                ORDER BY Value DESC
                """,
                dp,
                commandTimeout: _didban.CommandTimeoutSeconds,
                cancellationToken: ct))).ToList();

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

        return new UserRequestsResponse(
            new MetaDto("didban", DateTimeOffset.UtcNow, SqlFilterBuilder.PeriodLabel(baseFilter)),
            userId,
            normalizedRole,
            name ?? $"کاربر {userId}",
            items,
            stepHoursOpen,
            stepHoursClosed);
    }

    private static (
        string JoinSql,
        string UserPredicate,
        string StartExpr,
        string FinishExpr,
        string StepJoin,
        string StepNameExpr
    ) RequestDetailSql(string role) =>
        role switch
        {
            "referUser" => (
                "INNER JOIN dbo.CookieFlow f ON f.CookieId = c.CookieId",
                "COALESCE(f.ReferToUserId, f.CookieFlowVisitedUserId) = @userId",
                "f.CookieFlowTime",
                "f.CookieFlowFinishTime",
                "LEFT JOIN dbo.CookieStatus s ON s.CookieStatusId = f.CookieStatusId",
                "s.CookieStatusName"),
            "cartableUser" => (
                "INNER JOIN dbo.Cartable ct ON ct.CookieId = c.CookieId",
                "ct.CartableUserId = @userId",
                "ct.CartableTime",
                "ct.CartableFinishTime",
                "LEFT JOIN dbo.CookieStatus s ON s.CookieStatusId = c.CookieStatusId",
                "s.CookieStatusName"),
            "callUser" => (
                "INNER JOIN dbo.CallRecord cr ON cr.CookieId = c.CookieId",
                "cr.UserId = @userId",
                "c.CookieTime",
                "c.CookieFinishTime",
                "LEFT JOIN dbo.CookieStatus s ON s.CookieStatusId = c.CookieStatusId",
                "s.CookieStatusName"),
            "caseUser" => (
                "",
                "COALESCE(c.CookieUserId, c.UserId) = @userId",
                "c.CookieTime",
                "c.CookieFinishTime",
                "LEFT JOIN dbo.CookieStatus s ON s.CookieStatusId = c.CookieStatusId",
                "s.CookieStatusName"),
            _ => (
                "INNER JOIN dbo.CookieFlow f ON f.CookieId = c.CookieId",
                "COALESCE(f.CookieFlowUserId, f.UserId, f.InsertUserId) = @userId",
                "f.CookieFlowTime",
                "f.CookieFlowFinishTime",
                "LEFT JOIN dbo.CookieStatus s ON s.CookieStatusId = f.CookieStatusId",
                "s.CookieStatusName"),
        };
}
