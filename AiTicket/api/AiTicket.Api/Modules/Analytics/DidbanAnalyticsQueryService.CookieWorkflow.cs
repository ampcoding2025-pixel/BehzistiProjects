using AiTicket.Api.Contracts;
using Dapper;

namespace AiTicket.Api.Modules.Analytics;

public sealed partial class DidbanAnalyticsQueryService
{
    public async Task<CookieWorkflowResponse> GetCookieWorkflowAsync(long cookieId, CancellationToken ct)
    {
        await using var connection = await connectionFactory.OpenReadOnlyAsync(ct);

        var cookie = await connection.QuerySingleOrDefaultAsync<CookieMetaRow>(
            new CommandDefinition(
                """
                SELECT TOP 1
                  c.CookieId AS CookieId,
                  c.SubjectClassId AS SubjectClassId,
                  c.SubjectId AS SubjectId,
                  c.DepartmentId AS DepartmentId,
                  c.FlowId AS FlowId,
                  COALESCE(sc.SubjectClassName, N'نامشخص') AS SubjectClassName,
                  c.CookieStatusId AS CookieStatusId,
                  c.CookieTime AS CookieTime,
                  c.CookieFinishTime AS CookieFinishTime,
                  COALESCE(
                    NULLIF(LTRIM(RTRIM(sj.SubjectName)), N''),
                    N'پرونده ' + CAST(c.CookieId AS nvarchar(20))
                  ) AS Subject,
                  CASE WHEN c.CookieFinishTime IS NULL THEN CAST(1 AS bit) ELSE CAST(0 AS bit) END AS IsOpen
                FROM dbo.Cookie c
                LEFT JOIN dbo.SubjectClass sc ON sc.SubjectClassId = c.SubjectClassId
                LEFT JOIN dbo.Subject sj ON sj.SubjectId = c.SubjectId
                WHERE c.CookieId = @cookieId
                """,
                new { cookieId },
                commandTimeout: _didban.CommandTimeoutSeconds,
                cancellationToken: ct));

        if (cookie is null)
        {
            return new CookieWorkflowResponse(
                new MetaDto("didban", DateTimeOffset.UtcNow, "پرونده یافت نشد"),
                cookieId,
                $"پرونده {cookieId}",
                "نامشخص",
                true,
                null,
                Array.Empty<CookieWorkflowStepDto>(),
                "پرونده در دیده‌بان پیدا نشد");
        }

        var visits = (await connection.QueryAsync<FlowVisitRow>(
            new CommandDefinition(
                """
                SELECT
                  f.CookieFlowId AS FlowId,
                  f.CookieStatusId AS StatusId,
                  COALESCE(s.CookieStatusName, N'نامشخص') AS Name,
                  f.CookieFlowTime AS StartTime,
                  f.CookieFlowFinishTime AS FinishTime,
                  f.CookieFlowVisitedTime AS VisitedTime,
                  f.UpdateTime AS UpdateTime,
                  f.CookieFlowTakeTime AS TakeTime,
                  f.CookieFlowDelayTime AS DelayTime
                FROM dbo.CookieFlow f
                LEFT JOIN dbo.CookieStatus s ON s.CookieStatusId = f.CookieStatusId
                WHERE f.CookieId = @cookieId
                  AND f.CookieStatusId IS NOT NULL
                ORDER BY f.CookieFlowTime, f.CookieFlowId
                """,
                new { cookieId },
                commandTimeout: _didban.CommandTimeoutSeconds,
                cancellationToken: ct))).ToList();

        var now = DateTime.Now;
        AnnotateDwell(visits, cookie, now);

        var (canonical, pathNote) = await ResolveCanonicalPathAsync(connection, cookie, ct);
        if (cookie.IsOpen && cookie.FlowId is int openFlowId and > 0)
            canonical = await AppendRemainingFromCurrentAsync(connection, openFlowId, cookie, canonical, ct);
        else if (cookie.IsOpen)
        {
            var flow = await ResolveFlowAsync(connection, cookie, ct);
            if (flow is not null)
                canonical = await AppendRemainingFromCurrentAsync(connection, flow.FlowId, cookie, canonical, ct);
        }

        var steps = BuildWorkflowSteps(cookie, visits, canonical);
        var currentName = steps.FirstOrDefault(s => s.State == "current")?.Name
            ?? visits.LastOrDefault()?.Name;

        if (string.IsNullOrWhiteSpace(pathNote))
        {
            pathNote = steps.Count > 0
                ? "مسیر از گام‌های واقعی همین پرونده"
                : "گامی برای این پرونده ثبت نشده";
        }

        var lifetimeHours = HoursBetween(
            cookie.CookieTime,
            cookie.CookieFinishTime ?? (cookie.IsOpen ? now : cookie.CookieFinishTime));

        return new CookieWorkflowResponse(
            new MetaDto("didban", DateTimeOffset.UtcNow, pathNote),
            cookie.CookieId,
            cookie.Subject,
            cookie.SubjectClassName,
            cookie.IsOpen,
            currentName,
            steps,
            pathNote,
            lifetimeHours);
    }

    /// <summary>
    /// Sequential dwell: each step starts when the previous one exits.
    /// Exit = first timestamp after entry among Finish / Visited / Update / next start / cookie close.
    /// Ignores FinishTime == StartTime placeholders. Falls back to TakeTime only if clock is zero.
    /// </summary>
    private static void AnnotateDwell(
        IList<FlowVisitRow> visits,
        CookieMetaRow cookie,
        DateTime now)
    {
        DateTime? cursor = null;
        if (cookie.CookieTime is DateTime cookieStart)
            cursor = cookieStart;

        for (var i = 0; i < visits.Count; i++)
        {
            var v = visits[i];
            var entry = cursor
                        ?? v.StartTime
                        ?? After(DateTime.MinValue, v.StartTime);

            if (entry is null)
            {
                v.ExitTime = null;
                v.DwellHours = null;
                continue;
            }

            // If flow start is later than the chained cursor, the gap belongs to this step's entry.
            if (v.StartTime is DateTime flowStart && flowStart > entry.Value)
                entry = flowStart;

            var isTail = i == visits.Count - 1;
            var nextStart = i + 1 < visits.Count ? visits[i + 1].StartTime : null;

            var exit =
                After(entry.Value, v.FinishTime)
                ?? After(entry.Value, v.VisitedTime)
                ?? After(entry.Value, v.UpdateTime)
                ?? After(entry.Value, nextStart);

            if ((exit is null || exit <= entry) && isTail)
            {
                exit = After(entry.Value, cookie.CookieFinishTime)
                       ?? (cookie.IsOpen ? now : null);
            }

            if (exit is null || exit <= entry)
            {
                if (v.FinishTime is DateTime f && f > entry.Value)
                    exit = f;
            }

            // Still-open current step: measure until now even if FinishTime was filled early.
            if (cookie.IsOpen
                && cookie.CookieStatusId is int liveStatus
                && v.StatusId == liveStatus
                && isTail)
            {
                exit = now;
            }

            v.StartTime = entry;
            v.ExitTime = exit;

            var clock = HoursBetween(entry, exit);
            // Prefer clock span. TakeTime only for the final open/unknown-exit row.
            if (clock is > 0)
                v.DwellHours = clock;
            else if (exit is null && isTail)
                v.DwellHours = TakeTimeToHours(v.TakeTime, cookie, now) ?? 0;
            else
                v.DwellHours = 0; // instant / same-minute transition → آنی

            // Chain: next step begins when this one exits (or keeps cursor if unknown).
            if (exit is DateTime exited && exited > entry.Value)
                cursor = exited;
        }
    }

    private static DateTime? After(DateTime entry, DateTime? candidate) =>
        candidate is DateTime t && t > entry ? t : null;

    private static double? HoursBetween(DateTime? from, DateTime? to)
    {
        if (from is null || to is null) return null;
        if (to.Value < from.Value) return null;
        var hours = (to.Value - from.Value).TotalHours;
        if (hours <= 0) return 0;
        // Two decimals so sub-hour steps (e.g. 1–5 minutes) stay visible.
        return Math.Round(hours, 2);
    }

    private static double? TakeTimeToHours(long? raw, CookieMetaRow cookie, DateTime now)
    {
        if (raw is null or <= 0) return null;
        var t = (double)raw.Value;
        double hours;
        if (t >= 3_600_000) hours = t / 3_600_000.0;
        else if (t >= 300) hours = t / 3600.0;
        else hours = t / 60.0;
        hours = Math.Round(hours, 1);

        if (cookie.CookieTime is DateTime lifeStart)
        {
            var lifeEnd = cookie.CookieFinishTime ?? now;
            if (lifeEnd > lifeStart)
            {
                var life = (lifeEnd - lifeStart).TotalHours;
                if (hours > life * 1.05) return null;
            }
        }

        return hours;
    }

    private async Task<(IReadOnlyList<LearnedStepRow> Path, string Note)> ResolveCanonicalPathAsync(
        System.Data.Common.DbConnection connection,
        CookieMetaRow cookie,
        CancellationToken ct)
    {
        var flow = await ResolveFlowAsync(connection, cookie, ct);
        if (flow is not null)
        {
            var fromNodes = await WalkFlowNodesAsync(connection, flow.FlowId, ct);
            if (fromNodes.Count > 0)
            {
                return (
                    fromNodes,
                    $"مسیر تعریف‌شدهٔ گردش‌کار «{flow.FlowName}» (FlowId={flow.FlowId})");
            }
        }

        if (cookie.SubjectClassId is int classId and > 0)
        {
            var (learned, peerSample) = await LearnFromClosedPeersAsync(connection, classId, ct);
            if (learned.Count > 0)
            {
                return (
                    learned,
                    $"مسیر یادگرفته از {peerSample} پروندهٔ بسته‌شدهٔ طبقه «{cookie.SubjectClassName}»");
            }
        }

        return (Array.Empty<LearnedStepRow>(), "");
    }

    private async Task<FlowRefRow?> ResolveFlowAsync(
        System.Data.Common.DbConnection connection,
        CookieMetaRow cookie,
        CancellationToken ct)
    {
        if (cookie.FlowId is int cookieFlowId and > 0)
        {
            var byCookie = await connection.QuerySingleOrDefaultAsync<FlowRefRow>(
                new CommandDefinition(
                    """
                    SELECT TOP 1 FlowId, FlowName
                    FROM dbo.Flow
                    WHERE FlowId = @flowId AND FlowIsActive = 1
                    """,
                    new { flowId = cookieFlowId },
                    commandTimeout: _didban.CommandTimeoutSeconds,
                    cancellationToken: ct));
            if (byCookie is not null)
                return byCookie;
        }

        // SubjectClassMember often binds Subject(+class/dept) → FlowId
        var byMember = await connection.QuerySingleOrDefaultAsync<FlowRefRow>(
            new CommandDefinition(
                """
                SELECT TOP 1 f.FlowId, f.FlowName
                FROM dbo.SubjectClassMember m
                INNER JOIN dbo.Flow f ON f.FlowId = m.FlowId AND f.FlowIsActive = 1
                WHERE (@subjectId IS NULL OR m.SubjectId = @subjectId)
                  AND (@classId IS NULL OR m.SubjectClassId = @classId)
                  AND (@departmentId IS NULL OR m.DepartmentId = @departmentId OR m.DepartmentId IS NULL)
                ORDER BY
                  CASE WHEN m.SubjectId = @subjectId THEN 0 ELSE 1 END,
                  CASE WHEN m.DepartmentId = @departmentId THEN 0 ELSE 1 END,
                  f.FlowIsDefault DESC,
                  f.FlowId
                """,
                new
                {
                    subjectId = cookie.SubjectId,
                    classId = cookie.SubjectClassId,
                    departmentId = cookie.DepartmentId,
                },
                commandTimeout: _didban.CommandTimeoutSeconds,
                cancellationToken: ct));
        if (byMember is not null)
            return byMember;

        return await connection.QuerySingleOrDefaultAsync<FlowRefRow>(
            new CommandDefinition(
                """
                SELECT TOP 1 FlowId, FlowName
                FROM dbo.Flow
                WHERE CookieTypeId = @cookieTypeId AND FlowIsActive = 1
                ORDER BY FlowIsDefault DESC, FlowId
                """,
                new { cookieTypeId = _analytics.DefaultCookieTypeId },
                commandTimeout: _didban.CommandTimeoutSeconds,
                cancellationToken: ct));
    }

    private async Task<IReadOnlyList<LearnedStepRow>> WalkFlowNodesAsync(
        System.Data.Common.DbConnection connection,
        int flowId,
        CancellationToken ct)
    {
        var edges = (await connection.QueryAsync<FlowEdgeRow>(
            new CommandDefinition(
                """
                SELECT
                  fn.CookieStatusId AS FromStatusId,
                  fn.NextCookieStatusId AS ToStatusId,
                  COALESCE(ns.CookieStatusName, N'نامشخص') AS ToName,
                  CAST(CASE WHEN fn.FlowNodeNextStatusIsDefault = 1 THEN 1 ELSE 0 END AS bit) AS IsDefault
                FROM dbo.FlowNode fn
                INNER JOIN dbo.CookieStatus ns ON ns.CookieStatusId = fn.NextCookieStatusId
                WHERE fn.FlowId = @flowId
                """,
                new { flowId },
                commandTimeout: _didban.CommandTimeoutSeconds,
                cancellationToken: ct))).ToList();

        if (edges.Count == 0)
            return Array.Empty<LearnedStepRow>();

        var statusNames = (await connection.QueryAsync<(int StatusId, string Name)>(
            new CommandDefinition(
                """
                SELECT DISTINCT
                  COALESCE(fn.CookieStatusId, fn.NextCookieStatusId) AS StatusId,
                  COALESCE(s.CookieStatusName, N'نامشخص') AS Name
                FROM dbo.FlowNode fn
                LEFT JOIN dbo.CookieStatus s
                  ON s.CookieStatusId = COALESCE(fn.CookieStatusId, fn.NextCookieStatusId)
                WHERE fn.FlowId = @flowId
                """,
                new { flowId },
                commandTimeout: _didban.CommandTimeoutSeconds,
                cancellationToken: ct)))
            .ToDictionary(x => x.StatusId, x => x.Name);

        foreach (var e in edges)
            statusNames[e.ToStatusId] = e.ToName;

        // Prefer start edges with null From (entry), else statuses that never appear as a next.
        var nextSet = edges.Select(e => e.ToStatusId).ToHashSet();
        int? start = edges
            .Where(e => e.FromStatusId is null)
            .OrderByDescending(e => e.IsDefault)
            .Select(e => (int?)e.ToStatusId)
            .FirstOrDefault();

        if (start is null)
        {
            start = edges
                .Where(e => e.FromStatusId is int from && !nextSet.Contains(from))
                .OrderByDescending(e => e.IsDefault)
                .Select(e => e.FromStatusId)
                .FirstOrDefault();
        }

        start ??= edges.OrderByDescending(e => e.IsDefault).Select(e => (int?)e.ToStatusId).FirstOrDefault();
        if (start is null)
            return Array.Empty<LearnedStepRow>();

        var byFrom = edges
            .Where(e => e.FromStatusId is not null)
            .GroupBy(e => e.FromStatusId!.Value)
            .ToDictionary(
                g => g.Key,
                g => g.OrderByDescending(x => x.IsDefault).ThenBy(x => x.ToStatusId).ToList());

        var path = new List<LearnedStepRow>();
        var seen = new HashSet<int>();
        var current = start.Value;
        var guard = 0;
        while (guard++ < 40 && seen.Add(current))
        {
            path.Add(new LearnedStepRow
            {
                StatusId = current,
                Name = statusNames.GetValueOrDefault(current, "نامشخص"),
                AvgPos = path.Count + 1,
                PeerCount = 0,
            });

            if (!byFrom.TryGetValue(current, out var outs) || outs.Count == 0)
                break;

            current = outs[0].ToStatusId;
        }

        return path;
    }

    private async Task<(IReadOnlyList<LearnedStepRow> Path, int PeerSample)> LearnFromClosedPeersAsync(
        System.Data.Common.DbConnection connection,
        int classId,
        CancellationToken ct)
    {
        var peerSample = await connection.ExecuteScalarAsync<int>(
            new CommandDefinition(
                """
                SELECT COUNT(*) FROM (
                  SELECT TOP 200 c.CookieId
                  FROM dbo.Cookie c
                  WHERE c.SubjectClassId = @classId
                    AND c.CookieFinishTime IS NOT NULL
                    AND c.CookieTypeId = @cookieTypeId
                  ORDER BY c.CookieFinishTime DESC
                ) x
                """,
                new { classId, cookieTypeId = _analytics.DefaultCookieTypeId },
                commandTimeout: _didban.CommandTimeoutSeconds,
                cancellationToken: ct));

        if (peerSample <= 0)
            return (Array.Empty<LearnedStepRow>(), 0);

        var minPeers = Math.Max(2, (int)Math.Ceiling(peerSample * 0.08));
        var learned = (await connection.QueryAsync<LearnedStepRow>(
            new CommandDefinition(
                """
                ;WITH Peers AS (
                  SELECT TOP 200 c.CookieId
                  FROM dbo.Cookie c
                  WHERE c.SubjectClassId = @classId
                    AND c.CookieFinishTime IS NOT NULL
                    AND c.CookieTypeId = @cookieTypeId
                  ORDER BY c.CookieFinishTime DESC
                ),
                Ordered AS (
                  SELECT
                    f.CookieId,
                    f.CookieStatusId,
                    ROW_NUMBER() OVER (
                      PARTITION BY f.CookieId
                      ORDER BY f.CookieFlowTime, f.CookieFlowId
                    ) AS Pos
                  FROM dbo.CookieFlow f
                  INNER JOIN Peers p ON p.CookieId = f.CookieId
                  WHERE f.CookieStatusId IS NOT NULL
                ),
                FirstHit AS (
                  SELECT CookieId, CookieStatusId, MIN(Pos) AS FirstPos
                  FROM Ordered
                  GROUP BY CookieId, CookieStatusId
                )
                SELECT
                  fh.CookieStatusId AS StatusId,
                  COALESCE(s.CookieStatusName, N'نامشخص') AS Name,
                  AVG(CAST(fh.FirstPos AS float)) AS AvgPos,
                  COUNT_BIG(*) AS PeerCount
                FROM FirstHit fh
                LEFT JOIN dbo.CookieStatus s ON s.CookieStatusId = fh.CookieStatusId
                GROUP BY fh.CookieStatusId, s.CookieStatusName
                HAVING COUNT_BIG(*) >= @minPeers
                ORDER BY AvgPos, PeerCount DESC
                """,
                new { classId, cookieTypeId = _analytics.DefaultCookieTypeId, minPeers },
                commandTimeout: _didban.CommandTimeoutSeconds,
                cancellationToken: ct))).ToList();

        return (learned, peerSample);
    }

    private static IReadOnlyList<CookieWorkflowStepDto> BuildWorkflowSteps(
        CookieMetaRow cookie,
        IReadOnlyList<FlowVisitRow> visits,
        IReadOnlyList<LearnedStepRow> learned)
    {
        var firstByStatus = new Dictionary<int, FlowVisitRow>();
        var lastByStatus = new Dictionary<int, FlowVisitRow>();
        var dwellByStatus = new Dictionary<int, double>();
        foreach (var v in visits)
        {
            if (!firstByStatus.ContainsKey(v.StatusId))
                firstByStatus[v.StatusId] = v;
            lastByStatus[v.StatusId] = v;
            if (v.DwellHours is double h)
                dwellByStatus[v.StatusId] = dwellByStatus.GetValueOrDefault(v.StatusId) + h;
        }

        var path = new List<(int StatusId, string Name)>();
        var seen = new HashSet<int>();

        foreach (var l in learned)
        {
            if (seen.Add(l.StatusId))
                path.Add((l.StatusId, l.Name));
        }

        foreach (var v in visits)
        {
            if (seen.Contains(v.StatusId)) continue;
            var insertAt = path.Count;
            for (var i = 0; i < path.Count; i++)
            {
                if (!firstByStatus.TryGetValue(path[i].StatusId, out var peer)) continue;
                if (peer.StartTime is DateTime peerStart
                    && v.StartTime is DateTime mine
                    && mine < peerStart)
                {
                    insertAt = i;
                    break;
                }
            }
            path.Insert(insertAt, (v.StatusId, v.Name));
            seen.Add(v.StatusId);
        }

        if (path.Count == 0 && cookie.CookieStatusId is int curId)
        {
            path.Add((curId, visits.LastOrDefault(v => v.StatusId == curId)?.Name ?? "وضعیت جاری"));
        }

        var currentId = ResolveCurrentStatusId(cookie, visits, path);

        var currentIndex = -1;
        for (var i = 0; i < path.Count; i++)
        {
            if (path[i].StatusId == currentId)
            {
                currentIndex = i;
                break;
            }
        }

        // If current status is not on the learned path, use furthest visited path index.
        if (currentIndex < 0)
        {
            for (var i = 0; i < path.Count; i++)
            {
                if (firstByStatus.ContainsKey(path[i].StatusId))
                    currentIndex = i;
            }
        }

        if (!cookie.IsOpen && currentIndex < 0)
            currentIndex = path.Count - 1;

        var result = new List<CookieWorkflowStepDto>(path.Count);
        for (var i = 0; i < path.Count; i++)
        {
            var (statusId, name) = path[i];
            firstByStatus.TryGetValue(statusId, out var first);
            lastByStatus.TryGetValue(statusId, out var last);
            var visited = first != null;

            // Workflow progress:
            // - before current + visited → done
            // - before current + never visited → skipped (escaped)
            // - current → current (or done if cookie closed)
            // - after current → remaining (orange) while open; skipped if closed without visiting
            string state;
            if (currentIndex >= 0)
            {
                if (i < currentIndex)
                    state = visited ? "done" : "skipped";
                else if (i == currentIndex)
                    state = cookie.IsOpen ? "current" : "done";
                else if (cookie.IsOpen)
                    state = "remaining";
                else
                    state = visited ? "done" : "skipped";
            }
            else if (visited)
            {
                state = last?.ExitTime is null && cookie.IsOpen ? "current" : "done";
            }
            else
            {
                state = cookie.IsOpen ? "remaining" : "skipped";
            }

            double? dwell = dwellByStatus.TryGetValue(statusId, out var sum)
                ? Math.Round(sum, 2)
                : null;

            result.Add(new CookieWorkflowStepDto(
                i + 1,
                statusId,
                name,
                state,
                first?.StartTime,
                last?.ExitTime ?? last?.FinishTime,
                dwell));
        }

        // Cumulative time through each reached step (done/current); last reached = lifetime-so-far.
        double running = 0;
        var withCumulative = new List<CookieWorkflowStepDto>(result.Count);
        foreach (var step in result)
        {
            double? cumulative = null;
            if (step.State is "done" or "current")
            {
                running += step.Hours ?? 0;
                cumulative = Math.Round(running, 2);
            }

            withCumulative.Add(step with { CumulativeHours = cumulative });
        }

        return withCumulative;
    }

    private async Task<IReadOnlyList<LearnedStepRow>> AppendRemainingFromCurrentAsync(
        System.Data.Common.DbConnection connection,
        int flowId,
        CookieMetaRow cookie,
        IReadOnlyList<LearnedStepRow> path,
        CancellationToken ct)
    {
        if (cookie.CookieStatusId is not int currentStatus)
            return path;

        var edges = (await connection.QueryAsync<FlowEdgeRow>(
            new CommandDefinition(
                """
                SELECT
                  fn.CookieStatusId AS FromStatusId,
                  fn.NextCookieStatusId AS ToStatusId,
                  COALESCE(ns.CookieStatusName, N'نامشخص') AS ToName,
                  CAST(CASE WHEN fn.FlowNodeNextStatusIsDefault = 1 THEN 1 ELSE 0 END AS bit) AS IsDefault
                FROM dbo.FlowNode fn
                INNER JOIN dbo.CookieStatus ns ON ns.CookieStatusId = fn.NextCookieStatusId
                WHERE fn.FlowId = @flowId
                """,
                new { flowId },
                commandTimeout: _didban.CommandTimeoutSeconds,
                cancellationToken: ct))).ToList();

        if (edges.Count == 0)
            return path;

        var byFrom = edges
            .Where(e => e.FromStatusId is not null)
            .GroupBy(e => e.FromStatusId!.Value)
            .ToDictionary(
                g => g.Key,
                g => g.OrderByDescending(x => x.IsDefault).ThenBy(x => x.ToStatusId).ToList());

        var list = path.ToList();
        var seen = list.Select(p => p.StatusId).ToHashSet();
        var queue = new Queue<int>();
        queue.Enqueue(currentStatus);
        var guard = 0;
        while (queue.Count > 0 && guard++ < 40)
        {
            var from = queue.Dequeue();
            if (!byFrom.TryGetValue(from, out var outs)) continue;
            foreach (var edge in outs)
            {
                if (!seen.Add(edge.ToStatusId)) continue;
                list.Add(new LearnedStepRow
                {
                    StatusId = edge.ToStatusId,
                    Name = edge.ToName,
                    AvgPos = list.Count + 1,
                    PeerCount = 0,
                });
                queue.Enqueue(edge.ToStatusId);
            }
        }

        return list;
    }

    private static int? ResolveCurrentStatusId(
        CookieMetaRow cookie,
        IReadOnlyList<FlowVisitRow> visits,
        IReadOnlyList<(int StatusId, string Name)> path)
    {
        // Prefer the case-level status so open/closed matches the requests table.
        if (cookie.CookieStatusId is int statusId)
            return statusId;

        var openVisit = visits.LastOrDefault(v => v.FinishTime is null);
        if (openVisit != null)
            return openVisit.StatusId;

        return visits.LastOrDefault()?.StatusId
               ?? (path.Count > 0 ? path[^1].StatusId : null);
    }

    private sealed class CookieMetaRow
    {
        public long CookieId { get; init; }
        public int? SubjectClassId { get; init; }
        public int? SubjectId { get; init; }
        public int? DepartmentId { get; init; }
        public int? FlowId { get; init; }
        public string SubjectClassName { get; init; } = "";
        public int? CookieStatusId { get; init; }
        public DateTime? CookieTime { get; init; }
        public DateTime? CookieFinishTime { get; init; }
        public string Subject { get; init; } = "";
        public bool IsOpen { get; init; }
    }

    private sealed class FlowVisitRow
    {
        public long FlowId { get; init; }
        public int StatusId { get; init; }
        public string Name { get; init; } = "";
        public DateTime? StartTime { get; set; }
        public DateTime? FinishTime { get; init; }
        public DateTime? VisitedTime { get; init; }
        public DateTime? UpdateTime { get; init; }
        public long? TakeTime { get; init; }
        public long? DelayTime { get; init; }
        public DateTime? ExitTime { get; set; }
        public double? DwellHours { get; set; }
    }

    private sealed class LearnedStepRow
    {
        public int StatusId { get; init; }
        public string Name { get; init; } = "";
        public double AvgPos { get; init; }
        public long PeerCount { get; init; }
    }

    private sealed class FlowRefRow
    {
        public int FlowId { get; init; }
        public string FlowName { get; init; } = "";
    }

    private sealed class FlowEdgeRow
    {
        public int? FromStatusId { get; init; }
        public int ToStatusId { get; init; }
        public string ToName { get; init; } = "";
        public bool IsDefault { get; init; }
    }
}
