using System.ComponentModel;
using Microsoft.Data.SqlClient;

namespace AiTicket.Api.Infrastructure.Didban;

/// <summary>Retry helper for transport / Azure SQL transient failures (e.g. 10054).</summary>
public static class SqlTransient
{
    private static readonly HashSet<int> TransientNumbers =
    [
        -2, // client timeout
        64, 233, 10053, 10054, 10060,
        40197, 40501, 40613, 49918, 49919, 49920
    ];

    public static bool IsTransient(Exception ex)
    {
        for (var e = ex; e is not null; e = e.InnerException)
        {
            if (e is SqlException sql)
            {
                foreach (SqlError err in sql.Errors)
                {
                    if (TransientNumbers.Contains(err.Number))
                    {
                        return true;
                    }
                }

                if (TransientNumbers.Contains(sql.Number))
                {
                    return true;
                }
            }

            if (e is Win32Exception win && TransientNumbers.Contains(win.NativeErrorCode))
            {
                return true;
            }

            if (e is IOException)
            {
                return true;
            }
        }

        return false;
    }

    public static async Task<T> ExecuteAsync<T>(
        Func<Task<T>> action,
        ILogger logger,
        CancellationToken ct,
        int maxAttempts = 3)
    {
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                return await action();
            }
            catch (Exception ex) when (
                attempt < maxAttempts
                && IsTransient(ex)
                && !ct.IsCancellationRequested)
            {
                try
                {
                    SqlConnection.ClearAllPools();
                }
                catch
                {
                    // best-effort — poisoned pool connections must not block retry
                }

                var delay = TimeSpan.FromMilliseconds(250 * Math.Pow(2, attempt - 1));
                logger.LogWarning(
                    ex,
                    "Transient SQL failure (attempt {Attempt}/{Max}); retrying in {DelayMs}ms",
                    attempt,
                    maxAttempts,
                    delay.TotalMilliseconds);
                await Task.Delay(delay, ct);
            }
        }
    }
}
