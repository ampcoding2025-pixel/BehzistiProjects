using AiTicket.Api.Contracts;

namespace AiTicket.Api.Modules.Management;

public sealed record ManagementOverviewResponse(
    MetaDto Meta,
    string RuleSetVersion,
    IReadOnlyList<MgmtKpiCardDto> Kpis,
    IReadOnlyList<MgmtThroughputPointDto> ThroughputTrend,
    IReadOnlyList<MgmtTopicChangeDto> TopChangingTopics,
    IReadOnlyList<NamedValueDto> TopAttentionProvinces,
    IReadOnlyList<MgmtAlertDto> Alerts,
    IReadOnlyList<MgmtPriorityDto> Priorities,
    MgmtMapMetricDto MapMetric);

public sealed record MgmtKpiCardDto(
    string Id,
    string Label,
    double? Value,
    string Unit,
    double? SecondaryValue,
    string? SecondaryUnit,
    double? PreviousValue,
    double? DeltaPercent,
    string Tone,
    string Definition,
    string Confidence);

public sealed record MgmtThroughputPointDto(
    string Label,
    long Inflow,
    long Finished,
    long NetChange);

public sealed record MgmtTopicChangeDto(
    string Id,
    string Name,
    long Count,
    double SharePercent,
    double? DeltaPercent,
    string Trend,
    string Priority);

public sealed record MgmtAlertDto(
    string Id,
    string Change,
    string Where,
    string Impact,
    string SuggestedReview,
    string Severity);

public sealed record MgmtPriorityDto(
    string Id,
    string Title,
    string Evidence,
    string RelatedUnitOrProvince,
    string Trend,
    string SuggestedAction);

public sealed record MgmtMapMetricDto(
    string MetricId,
    string MetricLabel,
    IReadOnlyList<NamedValueDto> Provinces);

public sealed record ManagementDemandResponse(
    MetaDto Meta,
    IReadOnlyList<MgmtThroughputPointDto> InflowTrend,
    IReadOnlyList<NamedValueDto> ByClass,
    IReadOnlyList<MgmtTopicChangeDto> Topics,
    IReadOnlyList<NamedValueDto> TopSubjects);

public sealed record ManagementResolutionResponse(
    MetaDto Meta,
    IReadOnlyList<MgmtKpiCardDto> Kpis,
    IReadOnlyList<MgmtThroughputPointDto> ThroughputTrend,
    IReadOnlyList<NamedValueDto> StepsDistribution,
    string SlaNote);

public sealed record ManagementBacklogResponse(
    MetaDto Meta,
    IReadOnlyList<MgmtKpiCardDto> Kpis,
    IReadOnlyList<NamedValueDto> AgeBuckets,
    IReadOnlyList<MgmtUnitBacklogDto> Units,
    IReadOnlyList<MgmtThroughputPointDto> ThroughputTrend);

public sealed record MgmtUnitBacklogDto(
    string Name,
    long OpenCount,
    double? MedianAgeDays,
    long Over90,
    string Trend);

public sealed record ManagementProvincesResponse(
    MetaDto Meta,
    IReadOnlyList<MgmtProvinceRowDto> Provinces,
    IReadOnlyList<NamedValueDto> SelectedTrend);

public sealed record MgmtProvinceRowDto(
    int Id,
    string Name,
    long Cases,
    double ComplaintShare,
    double FinishRate,
    double? MedianDays,
    long OpenCount,
    double PursuitRate);

public sealed record ManagementQualityResponse(
    MetaDto Meta,
    string RuleSetVersion,
    IReadOnlyList<MgmtQualityMetricDto> Metrics,
    IReadOnlyList<string> Definitions,
    IReadOnlyList<MgmtAlertDto> QualityAlerts);

public sealed record MgmtQualityMetricDto(
    string Id,
    string Label,
    double? FillPercent,
    string Status,
    string Note);

public sealed record ManagementCriticalResponse(
    MetaDto Meta,
    IReadOnlyList<MgmtTopicChangeDto> Issues,
    IReadOnlyList<string> InvestigationSteps,
    IReadOnlyList<MgmtAlertDto> Hypotheses);
