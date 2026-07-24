namespace WildernessStays.Api.Agent;

/// <summary>Runtime settings for the Bedrock-backed concierge, supplied by the host config.</summary>
public class BedrockOptions
{
    /// <summary>When false, the agent endpoint replies with a friendly "not configured" message
    /// and never calls AWS. Lets the app run unchanged until credentials are in place.</summary>
    public bool Enabled { get; set; }

    /// <summary>AWS region hosting Bedrock, e.g. "us-east-1".</summary>
    public string Region { get; set; } = "us-east-1";

    /// <summary>Bedrock model (or inference-profile) id. Verify availability in your region.</summary>
    public string ModelId { get; set; } = "anthropic.claude-3-5-sonnet-20241022-v2:0";

    public int MaxTokens { get; set; } = 1024;

    /// <summary>Safety cap on the tool-use loop, so a misbehaving turn can't run unbounded.</summary>
    public int MaxToolIterations { get; set; } = 6;
}

/// <summary>One visible turn of the conversation, as the browser tracks it.</summary>
/// <param name="Role">"user" or "assistant".</param>
public record ChatTurn(string Role, string Text);

/// <summary>A guest's decision on a proposed sensitive action (book / cancel).</summary>
/// <param name="ResumeToken">Opaque state returned in the prior <see cref="PendingAction"/>.</param>
public record ConfirmationDecision(string ResumeToken, bool Approved);

/// <summary>Request body for POST /api/agent/chat.</summary>
public class AgentChatRequest
{
    /// <summary>The visible transcript so far (oldest first), including the newest user message.</summary>
    public List<ChatTurn> Messages { get; set; } = new();

    /// <summary>Set only when the guest is approving/declining a previously proposed action.</summary>
    public ConfirmationDecision? Confirm { get; set; }
}

/// <summary>A sensitive action the agent wants to take, surfaced for explicit approval.</summary>
/// <param name="Kind">"create_booking" or "cancel_booking".</param>
/// <param name="Summary">Human-readable one-liner with real figures (price / refund).</param>
/// <param name="Details">Structured preview the UI can render.</param>
/// <param name="ResumeToken">Echo this back in <see cref="ConfirmationDecision"/> to proceed.</param>
public record PendingAction(string Kind, string Summary, object Details, string ResumeToken);

/// <summary>Response body for POST /api/agent/chat.</summary>
public class AgentChatResponse
{
    /// <summary>"answered" (final reply) or "needs_confirmation" (a PendingAction awaits approval).</summary>
    public string Status { get; set; } = "answered";

    /// <summary>The assistant's natural-language reply. Always populated.</summary>
    public string Reply { get; set; } = "";

    /// <summary>Populated when Status == "needs_confirmation".</summary>
    public PendingAction? PendingAction { get; set; }
}
