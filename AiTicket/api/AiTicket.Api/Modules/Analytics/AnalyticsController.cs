using AiTicket.Api.Contracts;
using AiTicket.Api.Infrastructure.Didban;
using Microsoft.AspNetCore.Mvc;

namespace AiTicket.Api.Modules.Analytics;

[ApiController]
[Route("api/v1/analytics")]
public sealed class AnalyticsController(
    IAnalyticsQueryService analytics,
    IDidbanConnectionFactory connectionFactory) : ControllerBase
{
    [HttpGet("executive")]
    [ProducesResponseType(typeof(ExecutiveDashboardResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDto), StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<ExecutiveDashboardResponse>> GetExecutive(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int? departmentId,
        [FromQuery] int? subjectClassId,
        [FromQuery] int? channelId,
        [FromQuery] int? regionId,
        [FromQuery] int? zoneId,
        [FromQuery] int? subjectGroupId = null,
        [FromQuery] bool fresh = false,
        CancellationToken ct = default)
    {
        if (!connectionFactory.IsConfigured)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new ProblemDto(
                "https://aiticket.local/problems/didban-not-configured",
                "Didban not configured",
                503,
                "Set Didban:ConnectionString via user secrets or environment.",
                "didban_not_configured"));
        }

        var filter = new PeriodFilter(from, to, departmentId, subjectClassId, channelId, regionId, zoneId, subjectGroupId);
        var result = await analytics.GetExecutiveAsync(filter, ct, bypassCache: fresh);
        return Ok(result);
    }

    [HttpGet("requests")]
    [ProducesResponseType(typeof(RequestAnalyticsResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<RequestAnalyticsResponse>> GetRequests(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int? departmentId,
        [FromQuery] int? subjectClassId,
        [FromQuery] int? channelId,
        [FromQuery] int? regionId,
        [FromQuery] int? zoneId,
        [FromQuery] int? subjectGroupId = null,
        [FromQuery] int? cookieStatusId = null,
        [FromQuery] int? flowUserId = null,
        [FromQuery] int? referUserId = null,
        [FromQuery] int? cartableUserId = null,
        [FromQuery] int? callUserId = null,
        [FromQuery] int? caseUserId = null,
        CancellationToken ct = default)
    {
        if (!connectionFactory.IsConfigured)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new ProblemDto(
                "https://aiticket.local/problems/didban-not-configured",
                "Didban not configured",
                503,
                "Set Didban:ConnectionString via user secrets or environment.",
                "didban_not_configured"));
        }

        var filter = new PeriodFilter(
            from, to, departmentId, subjectClassId, channelId, regionId, zoneId, subjectGroupId,
            cookieStatusId, flowUserId, referUserId, cartableUserId, callUserId, caseUserId);
        return Ok(await analytics.GetRequestsAsync(filter, ct));
    }

    /// <summary>Monthly rate curve for one user: Rate = Load / AvgHours.</summary>
    [HttpGet("requests/user-rate-trend")]
    [ProducesResponseType(typeof(UserRateTrendResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<UserRateTrendResponse>> GetUserRateTrend(
        [FromQuery] int userId,
        [FromQuery] string role = "flowActor",
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] int? departmentId = null,
        [FromQuery] int? subjectClassId = null,
        [FromQuery] int? channelId = null,
        [FromQuery] int? regionId = null,
        [FromQuery] int? zoneId = null,
        [FromQuery] int? subjectGroupId = null,
        CancellationToken ct = default)
    {
        if (!connectionFactory.IsConfigured)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new ProblemDto(
                "https://aiticket.local/problems/didban-not-configured",
                "Didban not configured",
                503,
                "Set Didban:ConnectionString via user secrets or environment.",
                "didban_not_configured"));
        }

        if (userId <= 0)
            return BadRequest(new ProblemDto(
                "https://aiticket.local/problems/validation",
                "userId required",
                400,
                "Pass a positive userId.",
                "invalid_user_id"));

        var filter = new PeriodFilter(from, to, departmentId, subjectClassId, channelId, regionId, zoneId, subjectGroupId);
        return Ok(await analytics.GetUserRateTrendAsync(filter, userId, role, ct));
    }

    /// <summary>Open/closed + work-type bars for one user (status / subject class).</summary>
    [HttpGet("requests/user-work-distribution")]
    [ProducesResponseType(typeof(UserWorkDistributionResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<UserWorkDistributionResponse>> GetUserWorkDistribution(
        [FromQuery] int userId,
        [FromQuery] string role = "flowActor",
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] int? departmentId = null,
        [FromQuery] int? subjectClassId = null,
        [FromQuery] int? channelId = null,
        [FromQuery] int? regionId = null,
        [FromQuery] int? zoneId = null,
        [FromQuery] int? subjectGroupId = null,
        CancellationToken ct = default)
    {
        if (!connectionFactory.IsConfigured)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new ProblemDto(
                "https://aiticket.local/problems/didban-not-configured",
                "Didban not configured",
                503,
                "Set Didban:ConnectionString via user secrets or environment.",
                "didban_not_configured"));
        }

        if (userId <= 0)
            return BadRequest(new ProblemDto(
                "https://aiticket.local/problems/validation",
                "userId required",
                400,
                "Pass a positive userId.",
                "invalid_user_id"));

        var filter = new PeriodFilter(from, to, departmentId, subjectClassId, channelId, regionId, zoneId, subjectGroupId);
        return Ok(await analytics.GetUserWorkDistributionAsync(filter, userId, role, ct));
    }

    /// <summary>Per-request list for one user + step hour aggregates (open vs closed).</summary>
    [HttpGet("requests/user-requests")]
    [ProducesResponseType(typeof(UserRequestsResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<UserRequestsResponse>> GetUserRequests(
        [FromQuery] int userId,
        [FromQuery] string role = "flowActor",
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] int? departmentId = null,
        [FromQuery] int? subjectClassId = null,
        [FromQuery] int? channelId = null,
        [FromQuery] int? regionId = null,
        [FromQuery] int? zoneId = null,
        [FromQuery] int? subjectGroupId = null,
        CancellationToken ct = default)
    {
        if (!connectionFactory.IsConfigured)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new ProblemDto(
                "https://aiticket.local/problems/didban-not-configured",
                "Didban not configured",
                503,
                "Set Didban:ConnectionString via user secrets or environment.",
                "didban_not_configured"));
        }

        if (userId <= 0)
            return BadRequest(new ProblemDto(
                "https://aiticket.local/problems/validation",
                "userId required",
                400,
                "Pass a positive userId.",
                "invalid_user_id"));

        var filter = new PeriodFilter(from, to, departmentId, subjectClassId, channelId, regionId, zoneId, subjectGroupId);
        return Ok(await analytics.GetUserRequestsAsync(filter, userId, role, ct));
    }

    /// <summary>Learned workflow path for one cookie (from closed peers of same class) + progress.</summary>
    [HttpGet("requests/cookie-workflow")]
    [ProducesResponseType(typeof(CookieWorkflowResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<CookieWorkflowResponse>> GetCookieWorkflow(
        [FromQuery] long cookieId,
        CancellationToken ct = default)
    {
        if (!connectionFactory.IsConfigured)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new ProblemDto(
                "https://aiticket.local/problems/didban-not-configured",
                "Didban not configured",
                503,
                "Set Didban:ConnectionString via user secrets or environment.",
                "didban_not_configured"));
        }

        if (cookieId <= 0)
            return BadRequest(new ProblemDto(
                "https://aiticket.local/problems/validation",
                "cookieId required",
                400,
                "Pass a positive cookieId.",
                "invalid_cookie_id"));

        return Ok(await analytics.GetCookieWorkflowAsync(cookieId, ct));
    }

    [HttpGet("categories/tree")]
    [ProducesResponseType(typeof(CategoryExplorerResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<CategoryExplorerResponse>> GetCategoryTree(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int? departmentId,
        [FromQuery] int? subjectClassId,
        [FromQuery] int? channelId,
        [FromQuery] int? regionId,
        [FromQuery] int? zoneId,
        [FromQuery] int? subjectGroupId = null,
        CancellationToken ct = default)
    {
        if (!connectionFactory.IsConfigured)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new ProblemDto(
                "https://aiticket.local/problems/didban-not-configured",
                "Didban not configured",
                503,
                "Set Didban:ConnectionString via user secrets or environment.",
                "didban_not_configured"));
        }

        var filter = new PeriodFilter(from, to, departmentId, subjectClassId, channelId, regionId, zoneId, subjectGroupId);
        return Ok(await analytics.GetCategoryTreeAsync(filter, ct));
    }

    [HttpGet("topics")]
    [ProducesResponseType(typeof(TopicExplorerResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<TopicExplorerResponse>> GetTopics(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int? departmentId,
        [FromQuery] int? subjectClassId,
        [FromQuery] int? channelId,
        [FromQuery] int? regionId,
        [FromQuery] int? zoneId,
        [FromQuery] int? subjectGroupId = null,
        CancellationToken ct = default)
    {
        if (!connectionFactory.IsConfigured)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new ProblemDto(
                "https://aiticket.local/problems/didban-not-configured",
                "Didban not configured",
                503,
                "Set Didban:ConnectionString via user secrets or environment.",
                "didban_not_configured"));
        }

        var filter = new PeriodFilter(from, to, departmentId, subjectClassId, channelId, regionId, zoneId, subjectGroupId);
        return Ok(await analytics.GetTopicsAsync(filter, ct));
    }
}
