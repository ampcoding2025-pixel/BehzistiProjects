using AiTicket.Api.Contracts;

namespace AiTicket.Api.Modules.Kpis;

public sealed record KpiCatalogResponse(
    MetaDto Meta,
    string RuleSetVersion,
    KpiCatalogCountsDto Counts,
    IReadOnlyList<KpiCatalogItemDto> Items);

public sealed record KpiCatalogCountsDto(
    int Feasible,
    int NeedsRules,
    int WeakProxy,
    int Empty,
    int Audit);

public sealed record KpiCatalogItemDto(
    string Id,
    int? Rank,
    string Tier,
    string TableGroup,
    string Name,
    string Definition,
    string Formula,
    string Tables,
    string Feasibility,
    double? Value,
    string Unit,
    string? EmptyBlocker,
    string? Note,
    IReadOnlyList<NamedValueDto>? Breakdown,
    string ChartType,
    IReadOnlyList<KpiSeriesPointDto>? Series,
    IReadOnlyList<string> DrillDimensions);

public sealed record KpiSeriesPointDto(string Label, double Value);

public sealed record KpiDrillResponse(
    MetaDto Meta,
    string Code,
    string Dimension,
    string DimensionLabel,
    string MetricLabel,
    string Unit,
    bool CanDrillFurther,
    string? NextDimension,
    IReadOnlyList<KpiDrillPointDto> Points);

public sealed record KpiDrillPointDto(
    string Key,
    string Name,
    double Value,
    double? SecondaryValue = null);
