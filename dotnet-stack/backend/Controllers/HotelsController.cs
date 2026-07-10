using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WildernessStays.Api.Data;
using WildernessStays.Api.Services;

namespace WildernessStays.Api.Controllers;

[ApiController]
[Route("api/hotels")]
public class HotelsController(AppDbContext db, CacheService cache) : ControllerBase
{
    private static DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow);

    private async Task<HashSet<Guid>> BlockedRoomIdsAsync(Guid hotelId, DateOnly checkIn, DateOnly checkOut)
    {
        var ids = await db.Bookings
            .Where(b => b.HotelId == hotelId && b.RoomId != null && b.Status != "cancelled"
                        && b.CheckIn < checkOut && b.CheckOut > checkIn)
            .Select(b => b.RoomId!.Value)
            .Distinct()
            .ToListAsync();
        return ids.ToHashSet();
    }

    [HttpGet]
    public async Task<IActionResult> FindAll(
        [FromQuery] string? place, [FromQuery] decimal? minPrice, [FromQuery] decimal? maxPrice,
        [FromQuery] string? availableOnly, [FromQuery] DateOnly? checkIn, [FromQuery] DateOnly? checkOut)
    {
        var ci = checkIn ?? Today;
        var co = checkOut ?? Today.AddDays(1);

        var cacheKey = $"hotels:{place}|{minPrice}|{maxPrice}|{availableOnly}|{ci:O}|{co:O}";
        var cached = await cache.GetAsync<List<Dictionary<string, object>>>(cacheKey);
        if (cached is not null) return Ok(cached);

        var query = db.Hotels.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(place))
        {
            var q = place.ToLowerInvariant();
            query = query.Where(h =>
                h.Place.ToLower().Contains(q) || h.Region.ToLower().Contains(q) || h.Name.ToLower().Contains(q));
        }
        if (minPrice.HasValue) query = query.Where(h => h.PricePerNight >= minPrice.Value);
        if (maxPrice.HasValue) query = query.Where(h => h.PricePerNight <= maxPrice.Value);

        var hotels = await query.OrderByDescending(h => h.Rating).ToListAsync();
        var roomCounts = await db.Rooms.GroupBy(r => r.HotelId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count);

        var result = new List<object>();
        foreach (var h in hotels)
        {
            var blocked = await BlockedRoomIdsAsync(h.Id, ci, co);
            var total = roomCounts.GetValueOrDefault(h.Id);
            var free = Math.Max(0, total - blocked.Count);
            if (availableOnly == "true" && free == 0) continue;
            result.Add(new
            {
                id = h.Id, name = h.Name, place = h.Place, region = h.Region,
                description = h.Description, roomDescription = h.RoomDescription,
                pricePerNight = h.PricePerNight, rating = h.Rating, roomsTotal = total,
                amenities = h.Amenities, images = h.Images, nearbyPlaces = h.NearbyPlaces,
                createdAt = h.CreatedAt, roomsAvailable = free,
            });
        }

        await cache.SetAsync(cacheKey, result, 30);
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> FindOne(Guid id, [FromQuery] DateOnly? checkIn, [FromQuery] DateOnly? checkOut)
    {
        var hotel = await db.Hotels.AsNoTracking().FirstOrDefaultAsync(h => h.Id == id);
        if (hotel is null) return NotFound(new { message = "Hotel not found" });

        var ci = checkIn ?? Today;
        var co = checkOut ?? Today.AddDays(1);
        var blocked = await BlockedRoomIdsAsync(id, ci, co);
        var rooms = await db.Rooms.AsNoTracking()
            .Where(r => r.HotelId == id)
            .OrderByDescending(r => r.PricePerNight)
            .ToListAsync();

        var roomsOut = rooms.Select(r => new
        {
            id = r.Id, hotelId = r.HotelId, name = r.Name, description = r.Description,
            capacity = r.Capacity, pricePerNight = r.PricePerNight,
            amenities = r.Amenities, images = r.Images,
            available = !blocked.Contains(r.Id),
        }).ToList();

        return Ok(new
        {
            id = hotel.Id, name = hotel.Name, place = hotel.Place, region = hotel.Region,
            description = hotel.Description, roomDescription = hotel.RoomDescription,
            pricePerNight = hotel.PricePerNight, rating = hotel.Rating, roomsTotal = rooms.Count,
            amenities = hotel.Amenities, images = hotel.Images, nearbyPlaces = hotel.NearbyPlaces,
            createdAt = hotel.CreatedAt,
            roomsAvailable = roomsOut.Count(r => r.available),
            rooms = roomsOut,
        });
    }

    [HttpGet("{id:guid}/calendar")]
    public async Task<IActionResult> Calendar(Guid id, [FromQuery] DateOnly? start, [FromQuery] int days = 62, [FromQuery] Guid? roomId = null)
    {
        if (!await db.Hotels.AnyAsync(h => h.Id == id))
            return NotFound(new { message = "Hotel not found" });

        var startDate = start ?? Today;
        var span = Math.Clamp(days, 1, 186);
        var endDate = startDate.AddDays(span);
        var totalRooms = roomId.HasValue ? 1 : await db.Rooms.CountAsync(r => r.HotelId == id);

        var cacheKey = $"hotels:calendar:{id}:{roomId?.ToString() ?? "all"}:{startDate:O}:{span}";
        var cached = await cache.GetAsync<List<Dictionary<string, object>>>(cacheKey);
        if (cached is not null) return Ok(cached);

        var overlappingQuery = db.Bookings.AsNoTracking()
            .Where(b => b.HotelId == id && b.RoomId != null && b.Status != "cancelled"
                        && b.CheckIn < endDate && b.CheckOut > startDate);
        if (roomId.HasValue) overlappingQuery = overlappingQuery.Where(b => b.RoomId == roomId.Value);
        var overlapping = await overlappingQuery
            .Select(b => new { b.CheckIn, b.CheckOut, RoomId = b.RoomId!.Value })
            .ToListAsync();

        var result = new List<object>();
        for (var i = 0; i < span; i++)
        {
            var date = startDate.AddDays(i);
            var blockedToday = overlapping
                .Where(b => b.CheckIn <= date && date < b.CheckOut)
                .Select(b => b.RoomId)
                .Distinct()
                .Count();
            result.Add(new
            {
                date = date.ToString("yyyy-MM-dd"),
                available = Math.Max(0, totalRooms - blockedToday),
                total = totalRooms,
            });
        }

        await cache.SetAsync(cacheKey, result, 30);
        return Ok(result);
    }
}
