using AiTicket.Api.Contracts;
using Dapper;

namespace AiTicket.Api.Modules.Analytics;

public sealed partial class DidbanAnalyticsQueryService
{
    public async Task<UserWorkDistributionResponse> GetUserWorkDistributionAsync(
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

        var (joinSql, userPredicate, finishExpr, typeJoin, typeNameExpr) = WorkDistSql(normalizedRole);

        var byState = (await connection.QueryAsync<NamedValueDto>(
            new CommandDefinition(
                $"""
                SELECT
                  CASE WHEN ({finishExpr}) IS NULL THEN N'باز' ELSE N'بسته‌شده' END AS Name,
                  COUNT_BIG(*) AS Value
                FROM dbo.Cookie c
                {joinSql}
                {whereSql}
                  AND {userPredicate}
                GROUP BY CASE WHEN ({finishExpr}) IS NULL THEN N'باز' ELSE N'بسته‌شده' END
                ORDER BY Value DESC
                """,
                dp,
                cancellationToken: ct))).ToList();

        var byType = (await connection.QueryAsync<NamedValueDto>(
            new CommandDefinition(
                $"""
                SELECT TOP 12
                  COALESCE({typeNameExpr}, N'نامشخص') AS Name,
                  COUNT_BIG(*) AS Value
                FROM dbo.Cookie c
                {joinSql}
                {typeJoin}
                {whereSql}
                  AND {userPredicate}
                GROUP BY COALESCE({typeNameExpr}, N'نامشخص')
                ORDER BY Value DESC
                """,
                dp,
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

        return new UserWorkDistributionResponse(
            new MetaDto("didban", DateTimeOffset.UtcNow, SqlFilterBuilder.PeriodLabel(baseFilter)),
            userId,
            normalizedRole,
            name ?? $"کاربر {userId}",
            byState,
            byType);
    }

    /// <summary>
    /// finishExpr: column that means "closed" when non-null.
    /// type: CookieStatus for flow/cartable; SubjectClass for call/case.
    /// </summary>
    private static (string JoinSql, string UserPredicate, string FinishExpr, string TypeJoin, string TypeNameExpr)
        WorkDistSql(string role) =>
        role switch
        {
            "referUser" => (
                "INNER JOIN dbo.CookieFlow f ON f.CookieId = c.CookieId",
                "COALESCE(f.ReferToUserId, f.CookieFlowVisitedUserId) = @userId",
                "f.CookieFlowFinishTime",
                "LEFT JOIN dbo.CookieStatus s ON s.CookieStatusId = f.CookieStatusId",
                "s.CookieStatusName"),
            "cartableUser" => (
                "INNER JOIN dbo.Cartable ct ON ct.CookieId = c.CookieId",
                "ct.CartableUserId = @userId",
                "ct.CartableFinishTime",
                "LEFT JOIN dbo.CookieStatus s ON s.CookieStatusId = c.CookieStatusId",
                "s.CookieStatusName"),
            "callUser" => (
                "INNER JOIN dbo.CallRecord cr ON cr.CookieId = c.CookieId",
                "cr.UserId = @userId",
                "c.CookieFinishTime",
                "LEFT JOIN dbo.SubjectClass sc ON sc.SubjectClassId = c.SubjectClassId",
                "sc.SubjectClassName"),
            "caseUser" => (
                "",
                "COALESCE(c.CookieUserId, c.UserId) = @userId",
                "c.CookieFinishTime",
                "LEFT JOIN dbo.SubjectClass sc ON sc.SubjectClassId = c.SubjectClassId",
                "sc.SubjectClassName"),
            _ => (
                "INNER JOIN dbo.CookieFlow f ON f.CookieId = c.CookieId",
                "COALESCE(f.CookieFlowUserId, f.UserId, f.InsertUserId) = @userId",
                "f.CookieFlowFinishTime",
                "LEFT JOIN dbo.CookieStatus s ON s.CookieStatusId = f.CookieStatusId",
                "s.CookieStatusName"),
        };
}
