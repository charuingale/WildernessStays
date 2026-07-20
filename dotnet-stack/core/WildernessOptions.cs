namespace WildernessStays.Core;

/// <summary>Runtime settings for the core library, supplied by the host application.</summary>
public class WildernessOptions
{
    /// <summary>HS256 signing secret. No default — the host must supply one (fail closed).</summary>
    public string JwtSecret { get; set; } = "";

    public string RedisConnection { get; set; } = "localhost:6380";

    public string? StripeSecretKey { get; set; }

    /// <summary>
    /// When no Stripe key is configured, mock payments are only issued if this
    /// is explicitly enabled (hosts default it to true outside Production).
    /// </summary>
    public bool AllowMockPayments { get; set; }
}
