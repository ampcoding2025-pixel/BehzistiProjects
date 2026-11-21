using System.Text;
using AiTicket.Api.Contracts;

namespace AiTicket.Api.Modules.Analytics;

internal static class SqlFilterBuilder
{
    public static (string Sql, Dictionary<string, object?> Parameters) BuildCookieWhere(
        PeriodFilter filter,
        int defaultCookieTypeId,
        string cookieAlias = "c")
    {
        var sql = new StringBuilder($" WHERE {cookieAlias}.CookieTypeId = @cookieTypeId ");
        var parameters = new Dictionary<string, object?>
        {
            ["cookieTypeId"] = defaultCookieTypeId
        };

        if (filter.From is not null)
        {
            sql.Append($" AND {cookieAlias}.CookieTime >= @from ");
            parameters["from"] = filter.From.Value;
        }

        if (filter.To is not null)
        {
            sql.Append($" AND {cookieAlias}.CookieTime < @to ");
            parameters["to"] = filter.To.Value.Date.AddDays(1);
        }

        if (filter.DepartmentId is not null)
        {
            sql.Append($" AND {cookieAlias}.DepartmentId = @departmentId ");
            parameters["departmentId"] = filter.DepartmentId.Value;
        }

        if (filter.SubjectClassId is not null)
        {
            sql.Append($" AND {cookieAlias}.SubjectClassId = @subjectClassId ");
            parameters["subjectClassId"] = filter.SubjectClassId.Value;
        }

        if (filter.ChannelId is not null)
        {
            sql.Append($" AND {cookieAlias}.CookieChannelId = @channelId ");
            parameters["channelId"] = filter.ChannelId.Value;
        }

        if (filter.ZoneId is not null)
        {
            sql.Append($" AND {cookieAlias}.ZoneId = @zoneId ");
            parameters["zoneId"] = filter.ZoneId.Value;
        }

        if (filter.SubjectGroupId is not null)
        {
            sql.Append($" AND {cookieAlias}.SubjectGroupId = @subjectGroupId ");
            parameters["subjectGroupId"] = filter.SubjectGroupId.Value;
        }

        if (filter.RegionId is not null)
        {
            sql.Append($"""
                 AND EXISTS (
                   SELECT 1 FROM dbo.Inform ix
                   WHERE ix.CookieId = {cookieAlias}.CookieId AND ix.RegionId = @regionId)
                """);
            parameters["regionId"] = filter.RegionId.Value;
        }

        if (filter.CookieStatusId is not null)
        {
            sql.Append($"""
                 AND EXISTS (
                   SELECT 1 FROM dbo.CookieFlow fx
                   WHERE fx.CookieId = {cookieAlias}.CookieId AND fx.CookieStatusId = @cookieStatusId)
                """);
            parameters["cookieStatusId"] = filter.CookieStatusId.Value;
        }

        if (filter.FlowUserId is not null)
        {
            // Didban fills CookieFlowUserId; CookieFlow.UserId is often null
            sql.Append($"""
                 AND EXISTS (
                   SELECT 1 FROM dbo.CookieFlow fx
                   WHERE fx.CookieId = {cookieAlias}.CookieId
                     AND COALESCE(fx.CookieFlowUserId, fx.UserId, fx.InsertUserId) = @flowUserId)
                """);
            parameters["flowUserId"] = filter.FlowUserId.Value;
        }

        if (filter.ReferUserId is not null)
        {
            sql.Append($"""
                 AND EXISTS (
                   SELECT 1 FROM dbo.CookieFlow fx
                   WHERE fx.CookieId = {cookieAlias}.CookieId
                     AND COALESCE(fx.ReferToUserId, fx.CookieFlowVisitedUserId) = @referUserId)
                """);
            parameters["referUserId"] = filter.ReferUserId.Value;
        }

        if (filter.CartableUserId is not null)
        {
            sql.Append($"""
                 AND EXISTS (
                   SELECT 1 FROM dbo.Cartable cx
                   WHERE cx.CookieId = {cookieAlias}.CookieId AND cx.CartableUserId = @cartableUserId)
                """);
            parameters["cartableUserId"] = filter.CartableUserId.Value;
        }

        if (filter.CallUserId is not null)
        {
            sql.Append($"""
                 AND EXISTS (
                   SELECT 1 FROM dbo.CallRecord crx
                   WHERE crx.CookieId = {cookieAlias}.CookieId AND crx.UserId = @callUserId)
                """);
            parameters["callUserId"] = filter.CallUserId.Value;
        }

        if (filter.CaseUserId is not null)
        {
            sql.Append($" AND COALESCE({cookieAlias}.CookieUserId, {cookieAlias}.UserId) = @caseUserId ");
            parameters["caseUserId"] = filter.CaseUserId.Value;
        }

        return (sql.ToString(), parameters);
    }

    public static string PeriodLabel(PeriodFilter filter)
    {
        if (filter.From is null && filter.To is null)
        {
            return "کل دوره تاریخی فیلترنشده";
        }

        var from = filter.From?.ToString("yyyy-MM-dd") ?? "…";
        var to = filter.To?.ToString("yyyy-MM-dd") ?? "…";
        return $"{from} → {to}";
    }
}
