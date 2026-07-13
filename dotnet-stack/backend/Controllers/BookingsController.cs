using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WildernessStays.Core.Contracts;
using WildernessStays.Core.Services;

namespace WildernessStays.Api.Controllers;

[ApiController]
[Route("api/bookings")]
[Authorize]
public class BookingsController(BookingService bookings) : ControllerBase
{
    private Guid CurrentUserId => Guid.Parse(User.FindFirst("sub")!.Value);
    private bool IsAdmin => User.FindFirst("role")?.Value == "admin";

    [HttpGet]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> FindAll([FromQuery] string? search, [FromQuery] string? status, [FromQuery] Guid? hotelId) =>
        Ok(await bookings.FindAllAsync(search, status, hotelId));

    [HttpGet("mine")]
    public async Task<IActionResult> FindMine([FromQuery] string? search, [FromQuery] string? status) =>
        Ok(await bookings.FindAllAsync(search, status, null, CurrentUserId));

    [HttpGet("export/csv")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> ExportCsv([FromQuery] string? search, [FromQuery] string? status)
    {
        var csv = await bookings.ExportCsvAsync(search, status);
        return File(Encoding.UTF8.GetBytes(csv), "text/csv",
            $"bookings-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}.csv");
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> FindOne(Guid id) =>
        Ok(await bookings.FindOwnedAsync(id, CurrentUserId, IsAdmin));

    [HttpPost]
    public async Task<IActionResult> Create(CreateBookingDto dto) =>
        StatusCode(201, await bookings.CreateAsync(dto, CurrentUserId));

    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, UpdateBookingDto dto) =>
        Ok(await bookings.UpdateAsync(id, dto, CurrentUserId, IsAdmin));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Remove(Guid id)
    {
        await bookings.DeleteAsync(id, CurrentUserId, IsAdmin);
        return Ok(new { deleted = true });
    }
}
