using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Amazon.BedrockRuntime;
using Amazon.BedrockRuntime.Model;

namespace WildernessStays.Api.Agent;

/// <summary>
/// The Wilderness Stays concierge agent. Runs a tool-use loop against Anthropic Claude on
/// Amazon Bedrock (native Messages format via InvokeModel), executing read tools inline and
/// pausing for explicit guest confirmation before any booking or cancellation.
/// </summary>
public class BedrockConciergeService(
    IAmazonBedrockRuntime bedrock,
    BedrockOptions options,
    AgentTools tools,
    ILogger<BedrockConciergeService> logger)
{
    private const string SystemPrompt = """
        You are the Wilderness Stays concierge — a warm, concise guide to a collection of
        Canadian rustic-luxury lodges. Help guests discover lodges, check availability, and
        manage their own bookings.

        Rules:
        - Never invent lodge ids, room ids or prices. Always discover them with search_lodges
          and get_lodge_details first.
        - Gather what you need (destination, dates, guests, room) before proposing a booking.
        - Before create_booking or cancel_booking, state clearly what you're about to do and the
          cost or refund, then let the guest confirm. The system will also require explicit
          confirmation, so propose the action and wait.
        - You act only for the signed-in guest; you cannot see or touch other guests' bookings.
        - Keep replies short and friendly. Use CAD. Dates are YYYY-MM-DD.
        """;

    private static readonly JsonSerializerOptions J = new();

    public async Task<AgentChatResponse> ChatAsync(
        AgentChatRequest req, Guid userId, bool isAdmin, CancellationToken ct)
    {
        if (!options.Enabled)
            return new AgentChatResponse
            {
                Reply = "The concierge assistant isn't switched on yet. (Set Bedrock:Enabled once " +
                        "AWS credentials and model access are configured.)",
            };

        JsonArray messages;

        if (req.Confirm is not null)
        {
            // Resuming after the guest approved or declined a proposed sensitive action.
            var state = ResumeState.Decode(req.Confirm.ResumeToken);
            messages = state.Messages;

            if (req.Confirm.Approved)
            {
                var (result, isError) = await tools.ExecuteAsync(
                    state.PendingName, state.PendingInput, userId, isAdmin, ct);
                messages.Add(UserMessage(ToolResultBlock(state.PendingId, result, isError)));
            }
            else
            {
                messages.Add(UserMessage(ToolResultBlock(state.PendingId,
                    "{\"declined\":true,\"note\":\"The guest declined this action.\"}", isError: false)));
            }
        }
        else
        {
            messages = BuildMessages(req.Messages);
        }

        for (var i = 0; i < options.MaxToolIterations; i++)
        {
            var response = await InvokeAsync(messages, ct);
            var content = response["content"]?.AsArray() ?? new JsonArray();
            var stop = (string?)response["stop_reason"];

            if (stop != "tool_use")
                return new AgentChatResponse { Status = "answered", Reply = ExtractText(content) };

            // Record the assistant's turn (text + tool_use blocks) verbatim.
            messages.Add(new JsonObject { ["role"] = "assistant", ["content"] = Clone(content) });

            var toolUses = content.Where(b => (string?)b?["type"] == "tool_use").ToList();

            // If the model wants a sensitive action, pause and ask the guest to confirm.
            var sensitive = toolUses.FirstOrDefault(b => AgentTools.Sensitive.Contains((string)b!["name"]!));
            if (sensitive is not null)
            {
                var id = (string)sensitive["id"]!;
                var name = (string)sensitive["name"]!;
                var toolInput = sensitive["input"];

                var pending = await tools.DescribeAsync(name, toolInput, userId, isAdmin, ct);
                var token = new ResumeState(messages, id, name, toolInput).Encode();
                var text = ExtractText(content);

                return new AgentChatResponse
                {
                    Status = "needs_confirmation",
                    Reply = string.IsNullOrWhiteSpace(text) ? pending.Summary : text,
                    PendingAction = pending with { ResumeToken = token },
                };
            }

            // Otherwise run all read tools and feed the results back in one user turn.
            var results = new JsonArray();
            foreach (var tu in toolUses)
            {
                var (json, isError) = await tools.ExecuteAsync(
                    (string)tu!["name"]!, tu["input"], userId, isAdmin, ct);
                results.Add(ToolResultBlock((string)tu["id"]!, json, isError));
            }
            messages.Add(UserMessage(results));
        }

        logger.LogWarning("Concierge loop hit the {Max}-iteration cap", options.MaxToolIterations);
        return new AgentChatResponse
        {
            Reply = "Sorry — I got tangled up on that one. Could you rephrase or narrow it down?",
        };
    }

    // ---- Bedrock call (Anthropic native Messages format) ----
    private async Task<JsonNode> InvokeAsync(JsonArray messages, CancellationToken ct)
    {
        var body = new JsonObject
        {
            ["anthropic_version"] = "bedrock-2023-05-31",
            ["max_tokens"] = options.MaxTokens,
            ["system"] = SystemPrompt,
            ["tools"] = JsonNode.Parse(AgentTools.SpecsJson),
            ["messages"] = Clone(messages),
        };

        var request = new InvokeModelRequest
        {
            ModelId = options.ModelId,
            ContentType = "application/json",
            Accept = "application/json",
            Body = new MemoryStream(Encoding.UTF8.GetBytes(body.ToJsonString())),
        };

        var response = await bedrock.InvokeModelAsync(request, ct);
        using var reader = new StreamReader(response.Body);
        var text = await reader.ReadToEndAsync(ct);
        return JsonNode.Parse(text) ?? throw new InvalidOperationException("Empty Bedrock response");
    }

    // ---- helpers ----
    private static JsonArray BuildMessages(IEnumerable<ChatTurn> turns)
    {
        var arr = new JsonArray();
        foreach (var t in turns)
        {
            if (string.IsNullOrWhiteSpace(t.Text)) continue;
            var role = t.Role == "assistant" ? "assistant" : "user";
            arr.Add(new JsonObject
            {
                ["role"] = role,
                ["content"] = new JsonArray(new JsonObject { ["type"] = "text", ["text"] = t.Text }),
            });
        }
        return arr;
    }

    private static JsonObject ToolResultBlock(string toolUseId, string json, bool isError) => new()
    {
        ["type"] = "tool_result",
        ["tool_use_id"] = toolUseId,
        ["content"] = json,
        ["is_error"] = isError,
    };

    private static JsonObject UserMessage(JsonNode block) =>
        new() { ["role"] = "user", ["content"] = new JsonArray(block) };

    private static JsonObject UserMessage(JsonArray blocks) =>
        new() { ["role"] = "user", ["content"] = blocks };

    private static string ExtractText(JsonArray content) =>
        string.Join("\n", content
            .Where(b => (string?)b?["type"] == "text")
            .Select(b => (string?)b!["text"])
            .Where(s => !string.IsNullOrWhiteSpace(s)));

    /// <summary>Deep-clone a node so it can be attached to a new parent (JsonNode is single-parent).</summary>
    private static JsonNode Clone(JsonNode node) => JsonNode.Parse(node.ToJsonString())!;

    /// <summary>
    /// Stateless continuation for the confirm/decline round-trip: the full message list plus the
    /// paused tool_use, round-tripped through the browser as an opaque base64 token. The action
    /// still executes server-side as the JWT user with full validation, so a tampered token can't
    /// exceed that user's own permissions. For production, prefer caching this server-side (e.g.
    /// Redis) keyed by a random id instead of returning it to the client.
    /// </summary>
    private sealed record ResumeState(JsonArray Messages, string PendingId, string PendingName, JsonNode? PendingInput)
    {
        public string Encode()
        {
            var obj = new JsonObject
            {
                ["messages"] = Clone(Messages),
                ["id"] = PendingId,
                ["name"] = PendingName,
                ["input"] = PendingInput is null ? null : Clone(PendingInput),
            };
            return Convert.ToBase64String(Encoding.UTF8.GetBytes(obj.ToJsonString()));
        }

        public static ResumeState Decode(string token)
        {
            var json = Encoding.UTF8.GetString(Convert.FromBase64String(token));
            var o = JsonNode.Parse(json)!.AsObject();
            return new ResumeState(
                o["messages"]!.AsArray(),
                (string)o["id"]!,
                (string)o["name"]!,
                o["input"]);
        }
    }
}
