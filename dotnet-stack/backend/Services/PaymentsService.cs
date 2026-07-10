namespace WildernessStays.Api.Services;

/// <summary>
/// Stripe PaymentIntents via raw HttpClient when Stripe:SecretKey is set;
/// otherwise a mock reference so the demo works end-to-end without credentials.
/// </summary>
public class PaymentsService(IConfiguration config, IHttpClientFactory httpFactory, ILogger<PaymentsService> logger)
{
    public async Task<(string Ref, string Provider)> ChargeAsync(decimal amountCad, string description)
    {
        var key = config["Stripe:SecretKey"];
        if (string.IsNullOrWhiteSpace(key))
        {
            var mockRef = $"mock_pi_{Guid.NewGuid().ToString("N")[..12]}";
            logger.LogInformation("Mock payment of CAD {Amount:F2} — {Ref}", amountCad, mockRef);
            return (mockRef, "mock");
        }

        var client = httpFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new("Bearer", key);
        var body = new Dictionary<string, string>
        {
            ["amount"] = ((long)Math.Round(amountCad * 100)).ToString(),
            ["currency"] = "cad",
            ["description"] = description,
            ["automatic_payment_methods[enabled]"] = "true",
            ["automatic_payment_methods[allow_redirects]"] = "never",
        };
        var res = await client.PostAsync("https://api.stripe.com/v1/payment_intents", new FormUrlEncodedContent(body));
        if (!res.IsSuccessStatusCode)
        {
            logger.LogError("Stripe error: {Body}", await res.Content.ReadAsStringAsync());
            throw new InvalidOperationException("Payment processing failed");
        }
        var intent = System.Text.Json.JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        return (intent.RootElement.GetProperty("id").GetString()!, "stripe");
    }
}
