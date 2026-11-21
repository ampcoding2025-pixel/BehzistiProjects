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
    IReadOnlyList<MgmtClassValueDto> ByClass,
    IReadOnlyList<MgmtTopicChangeDto> Topics,
    IReadOnlyList<NamedValueDto> TopSubjects);

public sealed record MgmtClassValueDto(int Id, string Name, long Value);

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
    IReadOnlyList<MgmtRegionBacklogDto> Regions,
    IReadOnlyList<MgmtBacklogStageDto> Stages,
    IReadOnlyList<MgmtBacklogStageOperatorDto> StageOperators,
    IReadOnlyList<MgmtOperatorBacklogDto> Operators,
    IReadOnlyList<MgmtThroughputPointDto> ThroughputTrend);

public sealed record MgmtUnitBacklogDto(
    int? DepartmentId,
    string Name,
    long InflowCount,
    long FinishedCount,
    double FinishRate,
    double? AverageResolutionDays,
    long OpenCount,
    double? AverageAgeDays,
    long AgeLt7,
    long Age7To30,
    long Age30To90,
    long Over90,
    string Trend);

public sealed record MgmtRegionBacklogDto(
    int RegionId,
    string RegionName,
    int? DepartmentId,
    long AgeLt7,
    long Age7To30,
    long Age30To90,
    long Over90);

public sealed record MgmtBacklogStageDto(
    int? RegionId,
    string RegionName,
    int? StatusId,
    string StageName,
    long CaseCount,
    long FlowCount,
    double? AverageStageDurationHours);

public sealed record MgmtBacklogStageOperatorDto(
    int? RegionId,
    string RegionName,
    int? StatusId,
    string StageName,
    int OperatorId,
    int? RoleId,
    string RoleName,
    int? DepartmentId,
    string DepartmentName,
    long CaseCount,
    long FlowCount,
    double? AverageStageDurationHours);

public sealed record MgmtOperatorBacklogDto(
    int OperatorId,
    int? DepartmentId,
    string DepartmentName,
    long FlowCount,
    long CasesHandled,
    long CompletedFlows,
    double? AverageElapsedHours,
    long OpenCases,
    double? AverageOpenAgeDays,
    long OpenAgeLt7,
    long OpenAge7To30,
    long OpenAge30To90,
    long OpenAge90Plus);

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
