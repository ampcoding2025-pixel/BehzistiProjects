using AiTicket.Api.Contracts;
using AiTicket.Api.Infrastructure.Didban;
using AiTicket.Api.Modules.Analytics;
using Microsoft.AspNetCore.Mvc;

namespace AiTicket.Api.Modules.Kpis;

[ApiController]
[Route("api/v1/kpis")]
public sealed class KpisController(
    IAnalyticsQueryService analytics,
    IKpiCatalogQueryService catalog,
    IDidbanConnectionFactory connectionFactory) : ControllerBase
{
    [HttpGet("values")]
    [ProducesResponseType(typeof(KpiValuesResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<KpiValuesResponse>> GetValues(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int? departmentId,
        [FromQuery] int? subjectClassId,
        [FromQuery] int? channelId,
        [FromQuery] int? regionId,
        [FromQuery] int? zoneId,
        [FromQuery] string? codes,
        CancellationToken ct)
    {
        if (!connectionFactory.IsConfigured)
        {
            return NotConfigured();
        }

        var codeList = string.IsNullOrWhiteSpace(codes)
            ? null
            : codes.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        var filter = new PeriodFilter(from, to, departmentId, subjectClassId, channelId, regionId, zoneId);
        return Ok(await analytics.GetKpiValuesAsync(filter, codeList, ct));
    }

    /// <summary>Relation-first full KPI catalog with live measurements (docs/17).</summary>
    [HttpGet("catalog")]
    [ProducesResponseType(typeof(KpiCatalogResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<KpiCatalogResponse>> GetCatalog(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int? departmentId,
        [FromQuery] int? subjectClassId,
        [FromQuery] int? channelId,
        [FromQuery] int? regionId,
        [FromQuery] int? zoneId,
        CancellationToken ct)
    {
        if (!connectionFactory.IsConfigured)
        {
            return NotConfigured();
        }

        var filter = new PeriodFilter(from, to, departmentId, subjectClassId, channelId, regionId, zoneId);
        return Ok(await catalog.GetCatalogAsync(filter, ct));
    }

    /// <summary>Dimensional drill-down for a catalog KPI (department / region / channel / …).</summary>
    [HttpGet("catalog/{code}/drill")]
    [ProducesResponseType(typeof(KpiDrillResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<KpiDrillResponse>> GetCatalogDrill(
        string code,
        [FromQuery] string dimension = "department",
        [FromQuery] string? parentDimension = null,
        [FromQuery] string? parentKey = null,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] int? departmentId = null,
        [FromQuery] int? subjectClassId = null,
        [FromQuery] int? channelId = null,
        [FromQuery] int? regionId = null,
        [FromQuery] int? zoneId = null,
        CancellationToken ct = default)
    {
        if (!connectionFactory.IsConfigured)
        {
            return NotConfigured();
        }

        var filter = new PeriodFilter(from, to, departmentId, subjectClassId, channelId, regionId, zoneId);
        return Ok(await catalog.GetDrillAsync(code, dimension, filter, parentDimension, parentKey, ct));
    }

    private ObjectResult NotConfigured() =>
        StatusCode(StatusCodes.Status503ServiceUnavailable, new ProblemDto(
            "https://aiticket.local/problems/didban-not-configured",
            "Didban not configured",
            503,
            "Set Didban:ConnectionString via user secrets or environment.",
            "didban_not_configured"));
}
