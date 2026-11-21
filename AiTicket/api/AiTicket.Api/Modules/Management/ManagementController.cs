using AiTicket.Api.Contracts;
using AiTicket.Api.Infrastructure.Didban;
using Microsoft.AspNetCore.Mvc;

namespace AiTicket.Api.Modules.Management;

[ApiController]
[Route("api/v1/management")]
public sealed class ManagementController(
    IManagementQueryService management,
    IDidbanConnectionFactory connectionFactory) : ControllerBase
{
    [HttpGet("overview")]
    public Task<ActionResult<ManagementOverviewResponse>> Overview(
        [FromQuery] DateTime? from, [FromQuery] DateTime? to,
        [FromQuery] int? departmentId, [FromQuery] int? subjectClassId,
        [FromQuery] int? channelId, [FromQuery] int? regionId, [FromQuery] int? zoneId,
        CancellationToken ct) =>
        Run(from, to, departmentId, subjectClassId, channelId, regionId, zoneId,
            f => management.GetOverviewAsync(f, ct));

    [HttpGet("demand")]
    public Task<ActionResult<ManagementDemandResponse>> Demand(
        [FromQuery] DateTime? from, [FromQuery] DateTime? to,
        [FromQuery] int? departmentId, [FromQuery] int? subjectClassId,
        [FromQuery] int? channelId, [FromQuery] int? regionId, [FromQuery] int? zoneId,
        CancellationToken ct) =>
        Run(from, to, departmentId, subjectClassId, channelId, regionId, zoneId,
            f => management.GetDemandAsync(f, ct));

    [HttpGet("resolution")]
    public Task<ActionResult<ManagementResolutionResponse>> Resolution(
        [FromQuery] DateTime? from, [FromQuery] DateTime? to,
        [FromQuery] int? departmentId, [FromQuery] int? subjectClassId,
        [FromQuery] int? channelId, [FromQuery] int? regionId, [FromQuery] int? zoneId,
        CancellationToken ct) =>
        Run(from, to, departmentId, subjectClassId, channelId, regionId, zoneId,
            f => management.GetResolutionAsync(f, ct));

    [HttpGet("backlog")]
    public Task<ActionResult<ManagementBacklogResponse>> Backlog(
        [FromQuery] DateTime? from, [FromQuery] DateTime? to,
        [FromQuery] int? departmentId, [FromQuery] int? subjectClassId,
        [FromQuery] int? channelId, [FromQuery] int? regionId, [FromQuery] int? zoneId,
        [FromQuery] string? ageBucket, CancellationToken ct)
    {
        string[] allowedBuckets = ["age-lt7", "age-7-30", "age-30-90", "age-90p"];
        if (ageBucket is not null && !allowedBuckets.Contains(ageBucket, StringComparer.Ordinal))
        {
            return Task.FromResult<ActionResult<ManagementBacklogResponse>>(BadRequest(new ProblemDto(
                "https://aiticket.local/problems/invalid-age-bucket",
                "Invalid age bucket", 400,
                "Use age-lt7, age-7-30, age-30-90, or age-90p.",
                "invalid_age_bucket")));
        }

        return Run(from, to, departmentId, subjectClassId, channelId, regionId, zoneId,
            f => management.GetBacklogAsync(f, ageBucket, ct));
    }

    [HttpGet("provinces")]
    public Task<ActionResult<ManagementProvincesResponse>> Provinces(
        [FromQuery] DateTime? from, [FromQuery] DateTime? to,
        [FromQuery] int? departmentId, [FromQuery] int? subjectClassId,
        [FromQuery] int? channelId, [FromQuery] int? regionId, [FromQuery] int? zoneId,
        CancellationToken ct) =>
        Run(from, to, departmentId, subjectClassId, channelId, regionId, zoneId,
            f => management.GetProvincesAsync(f, ct));

    [HttpGet("quality")]
    public Task<ActionResult<ManagementQualityResponse>> Quality(
        [FromQuery] DateTime? from, [FromQuery] DateTime? to,
        [FromQuery] int? departmentId, [FromQuery] int? subjectClassId,
        [FromQuery] int? channelId, [FromQuery] int? regionId, [FromQuery] int? zoneId,
        CancellationToken ct) =>
        Run(from, to, departmentId, subjectClassId, channelId, regionId, zoneId,
            f => management.GetQualityAsync(f, ct));

    [HttpGet("critical")]
    public Task<ActionResult<ManagementCriticalResponse>> Critical(
        [FromQuery] DateTime? from, [FromQuery] DateTime? to,
        [FromQuery] int? departmentId, [FromQuery] int? subjectClassId,
        [FromQuery] int? channelId, [FromQuery] int? regionId, [FromQuery] int? zoneId,
        CancellationToken ct) =>
        Run(from, to, departmentId, subjectClassId, channelId, regionId, zoneId,
            f => management.GetCriticalAsync(f, ct));

    private async Task<ActionResult<T>> Run<T>(
        DateTime? from, DateTime? to,
        int? departmentId, int? subjectClassId, int? channelId, int? regionId, int? zoneId,
        Func<PeriodFilter, Task<T>> action)
    {
        if (!connectionFactory.IsConfigured)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new ProblemDto(
                "https://aiticket.local/problems/didban-not-configured",
                "Didban not configured", 503,
                "Set Didban:ConnectionString via user secrets or environment.",
                "didban_not_configured"));
        }

        var filter = new PeriodFilter(from, to, departmentId, subjectClassId, channelId, regionId, zoneId);
        return Ok(await action(filter));
    }
}
