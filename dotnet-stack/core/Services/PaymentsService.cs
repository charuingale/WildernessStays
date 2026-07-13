using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace WildernessStays.Core.Services;

/// <summary>
/// Stripe PaymentIntents via HttpClient when a secret key is configured;
/// otherwise a mock reference so the platform works end-to-end without credentials.
/// </summary>
public class PaymentsService(WildernessOptions options, ILogger<PaymentsService> logger)
{
    private static readonly HttpClient Http = new();

    public async Task<(string Ref, string Provider)> ChargeAsync(decimal amountCad, string description)
    {
        if (string.IsNullOrWhiteSpace(options.StripeSecretKey))
        {
            var mockRef = $"mock_pi_{Guid.NewGuid().ToString("N")[..12]}";
            logger.LogInformation("Mock payment of CAD {Amount:F2} — {Ref}", amountCad, mockRef);
            return (mockRef, "mock");
        }

        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.stripe.com/v1/payment_intents");
        request.Headers.Authorization = new("Bearer", options.StripeSecretKey);
        request.Content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["amount"] = ((long)Math.Round(amountCad * 100)).ToString(),
            ["currency"] = "cad",
            ["description"] = description,
            ["automatic_payment_methods[enabled]"] = "true",
            ["automatic_payment_methods[allow_redirects]"] = "never",
        });
        var res = await Http.SendAsync(request);
        if (!res.IsSuccessStatusCode)
        {
            logger.LogError("Stripe error: {Body}", await res.Content.ReadAsStringAsync());
            throw new InvalidOperationException("Payment processing failed");
        }
        var intent = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        return (intent.RootElement.GetProperty("id").GetString()!, "stripe");
    }

    /// <summary>Refund (part of) a charge. Mock mode issues a mock reference.</summary>
    public async Task<(string Ref, string Provider)> RefundAsync(decimal amountCad, string? paymentRef)
    {
        if (amountCad <= 0) return ("no_refund_due", "none");
        if (string.IsNullOrWhiteSpace(options.StripeSecretKey) || paymentRef is null || paymentRef.StartsWith("mock_"))
        {
            var mockRef = $"mock_re_{Guid.NewGuid().ToString("N")[..12]}";
            logger.LogInformation("Mock refund of CAD {Amount:F2} for {PaymentRef} — {Ref}", amountCad, paymentRef, mockRef);
            return (mockRef, "mock");
        }

        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.stripe.com/v1/refunds");
        request.Headers.Authorization = new("Bearer", options.StripeSecretKey);
        request.Content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["payment_intent"] = paymentRef,
            ["amount"] = ((long)Math.Round(amountCad * 100)).ToString(),
        });
        var res = await Http.SendAsync(request);
        if (!res.IsSuccessStatusCode)
        {
            logger.LogError("Stripe refund error: {Body}", await res.Content.ReadAsStringAsync());
            throw new InvalidOperationException("Refund processing failed");
        }
        var refund = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        return (refund.RootElement.GetProperty("id").GetString()!, "stripe");
    }
}
