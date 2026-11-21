using AiTicket.Api.Contracts;

namespace AiTicket.Api.Modules.Analytics;

public sealed record ExecutiveDashboardResponse(
    MetaDto Meta,
    string RuleSetVersion,
    IReadOnlyList<KpiCardDto> Kpis,
    IReadOnlyList<VolumeTrendPointDto> VolumeTrend,
    IReadOnlyList<NamedValueDto> ClassDistribution,
    IReadOnlyList<NamedValueDto> ChannelDistribution,
    IReadOnlyList<NamedValueDto> TopSubjects,
    IReadOnlyList<NamedValueDto> TopDepartments,
    AnswerCoverageDto AnswerCoverage,
    DecisionBriefDto DecisionBrief);

public sealed record VolumeTrendPointDto(string Label, long Requests, long Complaints);

public sealed record AnswerCoverageDto(
    double HistoricalAvailablePercent,
    double? CurrentlyValidPercent,
    double? NeedsReviewPercent,
    string ValidityStatus,
    string Caveat,
    double? ComplaintAvailablePercent = null,
    double? GuidanceAvailablePercent = null,
    double? ComplaintExVoiceAvailablePercent = null,
    long? VoiceNoiseComplaintCount = null,
    double? VoiceNoiseShareOfComplaintsPercent = null,
    long? AutoRegisterComplaintCount = null,
    double? AutoRegisterComplaintCoveragePercent = null);

/** Server-built story for decision makers — derived only from feasible metrics. */
public sealed record DecisionBriefDto(
    string BigIdea,
    IReadOnlyList<DecisionInsightDto> Insights);

public sealed record DecisionInsightDto(
    string Id,
    string Title,
    string Body,
    string Severity,
    string Priority);

public sealed record OpenClosedTrendPointDto(string Label, long Requests, long Closed);

/// <summary>Staff workload row: count + hours; zone ratio = Value / TotalHours.</summary>
public sealed class WorkloadUserDto
{
    public int? Id { get; init; }
    public string Name { get; init; } = "";
    public long Value { get; init; }
    /// <summary>Average elapsed hours including still-open items (Finish coalesced to now).</summary>
    public double? AvgHours { get; init; }
    /// <summary>Sum of elapsed hours across all items (open included) — denominator for ratio.</summary>
    public double? TotalHours { get; init; }
    /// <summary>Count of finished items in this aggregate (0 = open-only).</summary>
    public long FinishedCount { get; init; }
    /// <summary>Average hours on finished items only — scorecard speed when available.</summary>
    public double? AvgHoursFinished { get; init; }
}

public sealed record RequestAnalyticsResponse(
    MetaDto Meta,
    string RuleSetVersion,
    IReadOnlyList<KpiCardDto> Summary,
    IReadOnlyList<NamedValueDto> ByClass,
    IReadOnlyList<NamedValueDto> ByChannel,
    IReadOnlyList<NamedValueDto> ByRegion,
    IReadOnlyList<NamedValueDto> BySubjectGroup,
    IReadOnlyList<NamedValueDto> OpenClosed,
    IReadOnlyList<OpenClosedTrendPointDto> OpenClosedTrend,
    IReadOnlyList<NamedValueDto> ByWorkflowStep,
    IReadOnlyList<WorkloadUserDto> ByFlowActor,
    IReadOnlyList<WorkloadUserDto> ByFlowReferred,
    IReadOnlyList<WorkloadUserDto> ByCartableUser,
    IReadOnlyList<WorkloadUserDto> ByCallUser,
    IReadOnlyList<WorkloadUserDto> ByCaseUser);

public sealed record KpiValuesResponse(
    MetaDto Meta,
    string RuleSetVersion,
    IReadOnlyList<KpiValueDto> Values);

public sealed record KpiValueDto(
    string Code,
    string Feasibility,
    double? Value,
    string Unit,
    DateTimeOffset ComputedAt);

/// <summary>Monthly workload rate: Rate = Load / AvgHours when AvgHours &gt; 0.</summary>
public sealed record UserRatePointDto(string Label, long Load, double? AvgHours, double? Rate);

public sealed record UserRateTrendResponse(
    MetaDto Meta,
    int UserId,
    string Role,
    string Name,
    string Formula,
    IReadOnlyList<UserRatePointDto> Points);

/// <summary>Open/closed mix + CookieStatus (or class) breakdown for one staff user.</summary>
public sealed record UserWorkDistributionResponse(
    MetaDto Meta,
    int UserId,
    string Role,
    string Name,
    IReadOnlyList<NamedValueDto> ByState,
    IReadOnlyList<NamedValueDto> ByType);
