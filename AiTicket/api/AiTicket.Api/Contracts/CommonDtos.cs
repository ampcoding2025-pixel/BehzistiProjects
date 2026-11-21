namespace AiTicket.Api.Contracts;

public sealed record MetaDto(
    string Source,
    DateTimeOffset GeneratedAt,
    string PeriodLabel,
    IReadOnlyList<string>? Warnings = null);

public sealed record PeriodFilter(
    DateTime? From,
    DateTime? To,
    int? DepartmentId,
    int? SubjectClassId,
    int? ChannelId,
    int? RegionId,
    int? ZoneId,
    int? SubjectGroupId = null,
    int? CookieStatusId = null,
    int? FlowUserId = null,
    int? ReferUserId = null,
    int? CartableUserId = null,
    int? CallUserId = null,
    int? CaseUserId = null);

public sealed record KpiCardDto(
    string Id,
    string Label,
    double? Value,
    string? Unit,
    double? DeltaPercent,
    string? Tone,
    string? Hint,
    string Feasibility);

/// <summary>long Value matches SQL COUNT_BIG. Id is optional for cross-filter clicks.</summary>
public sealed class NamedValueDto
{
    public string Name { get; init; } = "";
    public long Value { get; init; }
    public int? Id { get; init; }

    public NamedValueDto()
    {
    }

    public NamedValueDto(string name, long value, int? id = null)
    {
        Name = name;
        Value = value;
        Id = id;
    }
}

public sealed record ProblemDto(
    string Type,
    string Title,
    int Status,
    string Detail,
    string Code);
