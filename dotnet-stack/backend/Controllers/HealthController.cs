using Microsoft.AspNetCore.Mvc;
using WildernessStays.Core.Data;

namespace WildernessStays.Api.Controllers;

[ApiController]
[Route("api/health")]
public class HealthController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Check()
    {
        var dbStatus = "down";
        try
        {
            if (await db.Database.CanConnectAsync()) dbStatus = "up";
        }
        catch { /* stays down */ }
        return Ok(new
        {
            status = dbStatus == "up" ? "ok" : "degraded",
            db = dbStatus,
            engine = "aspnet",
            uptimeSeconds = (int)(Environment.TickCount64 / 1000),
            timestamp = DateTime.UtcNow.ToString("o"),
        });
    }
}
