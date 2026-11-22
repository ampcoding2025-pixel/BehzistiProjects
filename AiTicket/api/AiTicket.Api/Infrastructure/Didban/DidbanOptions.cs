namespace AiTicket.Api.Infrastructure.Didban;

public sealed class DidbanOptions
{
    public const string SectionName = "Didban";

    public string ConnectionString { get; set; } = string.Empty;
    /// <summary>Per-command timeout for analytics queries (heavy multi-join scans).</summary>
    public int CommandTimeoutSeconds { get; set; } = 180;
    public bool TrustServerCertificate { get; set; } = true;
    public bool ReadOnlyEnforced { get; set; } = true;
}
