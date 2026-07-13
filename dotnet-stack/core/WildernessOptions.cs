namespace WildernessStays.Core;

/// <summary>Runtime settings for the core library, supplied by the host application.</summary>
public class WildernessOptions
{
    public string JwtSecret { get; set; } = "wilderness-dotnet-dev-secret-change-me-0123456789";
    public string RedisConnection { get; set; } = "localhost:6380";
    public string? StripeSecretKey { get; set; }
}
