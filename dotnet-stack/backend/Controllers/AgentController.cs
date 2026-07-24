using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WildernessStays.Api.Agent;

namespace WildernessStays.Api.Controllers;

/// <summary>
/// Conversational concierge. Every call runs as the signed-in guest, so the agent can only
/// see and act on that guest's own data (booking/cancellation tools use CurrentUserId).
/// </summary>
[ApiController]
[Route("api/agent")]
[Authorize]
public class AgentController(BedrockConciergeService concierge) : ControllerBase
{
    private Guid CurrentUserId => Guid.Parse(User.FindFirst("sub")!.Value);
    private bool IsAdmin => User.FindFirst("role")?.Value == "admin";

    [HttpPost("chat")]
    public async Task<IActionResult> Chat(AgentChatRequest req, CancellationToken ct) =>
        Ok(await concierge.ChatAsync(req, CurrentUserId, IsAdmin, ct));
}
