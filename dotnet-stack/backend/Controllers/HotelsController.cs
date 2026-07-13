using Microsoft.AspNetCore.Mvc;
using WildernessStays.Core.Services;

namespace WildernessStays.Api.Controllers;

[ApiController]
[Route("api/hotels")]
public class HotelsController(HotelService hotels) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> FindAll(
        [FromQuery] string? place, [FromQuery] decimal? minPrice, [FromQuery] decimal? maxPrice,
        [FromQuery] string? availableOnly, [FromQuery] DateOnly? checkIn, [FromQuery] DateOnly? checkOut) =>
        Ok(await hotels.FindAllAsync(place, minPrice, maxPrice, availableOnly == "true", checkIn, checkOut));

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> FindOne(Guid id, [FromQuery] DateOnly? checkIn, [FromQuery] DateOnly? checkOut)
    {
        var hotel = await hotels.FindOneAsync(id, checkIn, checkOut);
        return hotel is null ? NotFound(new { message = "Hotel not found" }) : Ok(hotel);
    }

    [HttpGet("{id:guid}/calendar")]
    public async Task<IActionResult> Calendar(
        Guid id, [FromQuery] DateOnly? start, [FromQuery] int days = 62, [FromQuery] Guid? roomId = null)
    {
        var calendar = await hotels.CalendarAsync(id, start, days, roomId);
        return calendar is null ? NotFound(new { message = "Hotel not found" }) : Ok(calendar);
    }
}
