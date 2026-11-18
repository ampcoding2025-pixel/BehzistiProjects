using AiTicket.Api.Contracts;
using AiTicket.Api.Modules.Analytics;
using Dapper;

namespace AiTicket.Api.Modules.Kpis;

public sealed partial class DidbanKpiCatalogQueryService
{
    private static readonly Dictionary<string, string> DimensionLabels = new(StringComparer.OrdinalIgnoreCase)
    {
        ["department"] = "واحد سازمانی",
        ["region"] = "استان",
        ["channel"] = "کانال",
        ["subjectClass"] = "طبقه موضوع",
        ["subject"] = "موضوع",
    };

    public async Task<KpiDrillResponse> GetDrillAsync(
        string code,
        string dimension,
        PeriodFilter filter,
        string? parentDimension,
        string? parentKey,
        CancellationToken ct)
    {
        var metric = ResolveMetric(code);
        if (metric is null)
        {
            return new KpiDrillResponse(
                new MetaDto("didban", DateTimeOffset.UtcNow, SqlFilterBuilder.PeriodLabel(filter),
                    [$"کد شاخص ناشناخته: {code}"]),
                code, dimension, DimensionLabels.GetValueOrDefault(dimension, dimension),
                "—", "count", false, null, Array.Empty<KpiDrillPointDto>());
        }

        if (!DimensionLabels.ContainsKey(dimension))
        {
            return new KpiDrillResponse(
                new MetaDto("didban", DateTimeOffset.UtcNow, SqlFilterBuilder.PeriodLabel(filter),
                    [$"بُعد ناشناخته: {dimension}"]),
                code, dimension, dimension, metric.Label, metric.Unit, false, null,
                Array.Empty<KpiDrillPointDto>());
        }

        await using var connection = await connectionFactory.OpenReadOnlyAsync(ct);
        var (whereSql, parameters) = SqlFilterBuilder.BuildCookieWhere(filter, _analytics.DefaultCookieTypeId);
        whereSql = AppendParentFilter(whereSql, parameters, parentDimension, parentKey);
        var dp = ToDynamic(parameters);

        var (selectSql, groupSql, keyExpr) = DimensionSql(dimension);
        var sql = $"""
            SELECT TOP 20
              CAST({keyExpr} AS nvarchar(64)) AS [Key],
              {selectSql} AS Name,
              {metric.AggregateSql} AS Value
            FROM dbo.Cookie c
            {metric.Joins}
            {whereSql}
            GROUP BY {groupSql}
            HAVING {metric.AggregateSql} IS NOT NULL
            ORDER BY Value DESC
            """;

        var rows = (await connection.QueryAsync<DrillRow>(
            new CommandDefinition(sql, dp, cancellationToken: ct))).ToList();

        var next = NextDimension(dimension);
        var points = rows
            .Select(r => new KpiDrillPointDto(
                r.Key ?? "",
                string.IsNullOrWhiteSpace(r.Name) ? "(بدون نام)" : r.Name!,
                Math.Round(r.Value, 2)))
            .ToList();

        return new KpiDrillResponse(
            new MetaDto("didban", DateTimeOffset.UtcNow, SqlFilterBuilder.PeriodLabel(filter)),
            code.ToUpperInvariant(),
            dimension,
            DimensionLabels[dimension],
            metric.Label,
            metric.Unit,
            next is not null && points.Count > 0,
            next,
            points);
    }

    private static string AppendParentFilter(
        string whereSql,
        Dictionary<string, object?> parameters,
        string? parentDimension,
        string? parentKey)
    {
        if (string.IsNullOrWhiteSpace(parentDimension) || string.IsNullOrWhiteSpace(parentKey))
        {
            return whereSql;
        }

        switch (parentDimension.ToLowerInvariant())
        {
            case "department":
                parameters["parentDept"] = int.TryParse(parentKey, out var d) ? d : -1;
                return whereSql + " AND c.DepartmentId = @parentDept ";
            case "region":
                parameters["parentRegion"] = int.TryParse(parentKey, out var r) ? r : -1;
                return whereSql + """
                     AND EXISTS (
                       SELECT 1 FROM dbo.Inform i2
                       WHERE i2.CookieId = c.CookieId AND i2.RegionId = @parentRegion)
                    """;
            case "channel":
                parameters["parentChannel"] = int.TryParse(parentKey, out var ch) ? ch : -1;
                return whereSql + " AND c.CookieChannelId = @parentChannel ";
            case "subjectclass":
                parameters["parentClass"] = int.TryParse(parentKey, out var sc) ? sc : -1;
                return whereSql + " AND c.SubjectClassId = @parentClass ";
            case "subject":
                parameters["parentSubject"] = int.TryParse(parentKey, out var s) ? s : -1;
                return whereSql + " AND c.SubjectId = @parentSubject ";
            default:
                return whereSql;
        }
    }

    private static (string SelectName, string GroupBy, string KeyExpr) DimensionSql(string dimension) =>
        dimension.ToLowerInvariant() switch
        {
            "department" => ("d.DepartmentName", "c.DepartmentId, d.DepartmentName", "c.DepartmentId"),
            "region" => ("r.RegionName", "i.RegionId, r.RegionName", "i.RegionId"),
            "channel" => ("ch.CookieChannelName", "c.CookieChannelId, ch.CookieChannelName", "c.CookieChannelId"),
            // Must be lowercase — input is normalized with ToLowerInvariant()
            "subjectclass" => ("sc.SubjectClassName", "c.SubjectClassId, sc.SubjectClassName", "c.SubjectClassId"),
            "subject" => ("s.SubjectName", "c.SubjectId, s.SubjectName", "c.SubjectId"),
            _ => throw new ArgumentOutOfRangeException(nameof(dimension), dimension, "Unsupported drill dimension.")
        };

    private static string? NextDimension(string dimension) =>
        dimension.ToLowerInvariant() switch
        {
            "region" => "department",
            "department" => "subject",
            "channel" => "department",
            "subjectclass" => "subject",
            "subject" => null,
            _ => null
        };

    private sealed record MetricDef(string Label, string Unit, string AggregateSql, string Joins);

    private MetricDef? ResolveMetric(string code)
    {
        var dimJoins = """
            LEFT JOIN dbo.Department d ON d.DepartmentId = c.DepartmentId
            LEFT JOIN dbo.Inform i ON i.CookieId = c.CookieId
            LEFT JOIN dbo.Region r ON r.RegionId = i.RegionId
            LEFT JOIN dbo.CookieChannel ch ON ch.CookieChannelId = c.CookieChannelId
            LEFT JOIN dbo.SubjectClass sc ON sc.SubjectClassId = c.SubjectClassId
            LEFT JOIN dbo.Subject s ON s.SubjectId = c.SubjectId
            """;

        return code.Trim().ToUpperInvariant() switch
        {
            "V1" or "V8" or "O1" or "V5" or "V6" or "V7" or "V3" or "V4" or "V10" or "R5" or "R14"
                => new("تعداد پرونده", "count", "COUNT_BIG(*)", dimJoins),
            "V2" => new("تعداد شکایت", "count",
                "SUM(CASE WHEN c.SubjectClassId = 1 THEN 1 ELSE 0 END)", dimJoins),
            "R1" => new("نرخ اتمام ٪", "percent",
                """
                CASE WHEN COUNT_BIG(*) = 0 THEN 0
                     ELSE ROUND(100.0 * SUM(CASE WHEN c.CookieFinishTime IS NOT NULL THEN 1 ELSE 0 END) / COUNT_BIG(*), 1)
                END
                """, dimJoins),
            "R2" => new("میانگین روز تا اتمام", "days",
                """
                AVG(CASE WHEN c.CookieFinishTime IS NOT NULL
                         THEN CAST(DATEDIFF(day, c.CookieTime, c.CookieFinishTime) AS float) END)
                """, dimJoins),
            "R3" => new("بدون اتمام", "count",
                "SUM(CASE WHEN c.CookieFinishTime IS NULL THEN 1 ELSE 0 END)", dimJoins),
            "R7" => new("نرخ توزیع مجدد ٪", "percent",
                """
                CASE WHEN COUNT_BIG(*) = 0 THEN 0
                     ELSE ROUND(100.0 * SUM(CASE WHEN c.CookieStatusId = 40 THEN 1 ELSE 0 END) / COUNT_BIG(*), 1)
                END
                """, dimJoins),
            "R8" => new("نرخ ارجاع ٪", "percent",
                """
                CASE WHEN COUNT_BIG(*) = 0 THEN 0
                     ELSE ROUND(100.0 * SUM(CASE WHEN c.CookieStatusId = 31 THEN 1 ELSE 0 END) / COUNT_BIG(*), 1)
                END
                """, dimJoins),
            "P1" => new("نرخ پیگیری ٪", "percent",
                """
                CASE WHEN COUNT_BIG(*) = 0 THEN 0
                     ELSE ROUND(100.0 * SUM(CASE WHEN ISNULL(c.CookiePersuitsCount,0) > 0 THEN 1 ELSE 0 END) / COUNT_BIG(*), 1)
                END
                """, dimJoins),
            "P2" => new("میانگین پیگیری", "ratio",
                "AVG(CASE WHEN ISNULL(c.CookiePersuitsCount,0) > 0 THEN CAST(c.CookiePersuitsCount AS float) END)",
                dimJoins),
            "A1" => new("پوشش پاسخ ٪", "percent",
                """
                CASE WHEN COUNT_BIG(*) = 0 THEN 0
                     ELSE ROUND(100.0 * COUNT_BIG(replied.CookieId) / COUNT_BIG(*), 1)
                END
                """,
                dimJoins + """
                    
                    LEFT JOIN (
                      SELECT DISTINCT f.CookieId
                      FROM dbo.CookieFlow f
                      WHERE f.CookieFlowReplyCitizen IS NOT NULL
                        AND LEN(LTRIM(RTRIM(f.CookieFlowReplyCitizen))) > 0
                    ) replied ON replied.CookieId = c.CookieId
                    """),
            "O5" or "V17" => new("سهم/تعداد با Agent", "count",
                "SUM(CASE WHEN c.AgentId IS NOT NULL THEN 1 ELSE 0 END)", dimJoins),
            "V9" => new("پرونده بحرانی", "count",
                "SUM(CASE WHEN ISNULL(c.CookieIsCritical,0) = 1 THEN 1 ELSE 0 END)", dimJoins),
            "V11" => new("پرونده مرتبط", "count",
                "SUM(CASE WHEN c.ReferringCookieId IS NOT NULL THEN 1 ELSE 0 END)", dimJoins),
            "E1" => new("تعداد پرونده (پایه بازدید)", "count", "COUNT_BIG(*)", dimJoins),
            "R12" or "R13" or "R10" or "R11" => new("تعداد پرونده", "count", "COUNT_BIG(*)", dimJoins),
            _ => null
        };
    }

    private sealed class DrillRow
    {
        public string? Key { get; init; }
        public string? Name { get; init; }
        public double Value { get; init; }
    }
}
