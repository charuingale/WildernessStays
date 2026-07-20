using Microsoft.EntityFrameworkCore;
using WildernessStays.Core.Contracts;
using WildernessStays.Core.Data;

namespace WildernessStays.Core.Services;

/// <summary>Search, availability, and calendar logic for hotels and their rooms.</summary>
public class HotelService(AppDbContext db, CacheService cache)
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

    /// <summary>Invalid stay ranges would report every room available and poison the cache.</summary>
    private static void AssertValidRange(DateOnly ci, DateOnly co)
    {
        if (co <= ci) throw new DomainValidationException("checkOut must be after checkIn");
    }

    public async Task<List<HotelSummary>> FindAllAsync(
        string? place, decimal? minPrice, decimal? maxPrice, bool availableOnly,
        DateOnly? checkIn, DateOnly? checkOut)
    {
        var ci = checkIn ?? Today;
        var co = checkOut ?? Today.AddDays(1);
        AssertValidRange(ci, co);

        var cacheKey = $"hotels:{place}|{minPrice}|{maxPrice}|{availableOnly}|{ci:O}|{co:O}";
        var cached = await cache.GetAsync<List<HotelSummary>>(cacheKey);
        if (cached is not null) return cached;

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

        // Batched: one query for all hotels' blocked rooms (previously one per hotel — N+1).
        var overlapping = await db.Bookings.AsNoTracking()
            .Where(b => b.RoomId != null && b.Status != "cancelled"
                        && b.CheckIn < co && b.CheckOut > ci)
            .Select(b => new { b.HotelId, RoomId = b.RoomId!.Value })
            .Distinct()
            .ToListAsync();
        var blockedByHotel = overlapping
            .GroupBy(x => x.HotelId)
            .ToDictionary(g => g.Key, g => g.Select(x => x.RoomId).ToHashSet());

        var result = new List<HotelSummary>();
        foreach (var h in hotels)
        {
            var blocked = blockedByHotel.GetValueOrDefault(h.Id) ?? new HashSet<Guid>();
            var total = roomCounts.GetValueOrDefault(h.Id);
            var free = Math.Max(0, total - blocked.Count);
            if (availableOnly && free == 0) continue;
            result.Add(new HotelSummary(h.Id, h.Name, h.Place, h.Region, h.Description, h.RoomDescription,
                h.PricePerNight, h.Rating, total, h.Amenities, h.Images, h.NearbyPlaces, h.CreatedAt, free));
        }

        await cache.SetAsync(cacheKey, result, 30);
        return result;
    }

    public async Task<HotelDetail?> FindOneAsync(Guid id, DateOnly? checkIn, DateOnly? checkOut)
    {
        var hotel = await db.Hotels.AsNoTracking().FirstOrDefaultAsync(h => h.Id == id);
        if (hotel is null) return null;

        var ci = checkIn ?? Today;
        var co = checkOut ?? Today.AddDays(1);
        AssertValidRange(ci, co);
        var blocked = await BlockedRoomIdsAsync(id, ci, co);
        var rooms = await db.Rooms.AsNoTracking()
            .Where(r => r.HotelId == id)
            .OrderByDescending(r => r.PricePerNight)
            .ToListAsync();

        var roomViews = rooms.Select(r => new RoomView(r.Id, r.HotelId, r.Name, r.Description,
            r.Capacity, r.PricePerNight, r.Amenities, r.Images, !blocked.Contains(r.Id))).ToList();

        return new HotelDetail(hotel.Id, hotel.Name, hotel.Place, hotel.Region, hotel.Description,
            hotel.RoomDescription, hotel.PricePerNight, hotel.Rating, rooms.Count, hotel.Amenities,
            hotel.Images, hotel.NearbyPlaces, hotel.CreatedAt,
            roomViews.Count(r => r.Available), roomViews);
    }

    public async Task<List<CalendarDay>?> CalendarAsync(Guid id, DateOnly? start, int days, Guid? roomId)
    {
        if (!await db.Hotels.AnyAsync(h => h.Id == id)) return null;

        var startDate = start ?? Today;
        var span = Math.Clamp(days, 1, 186);
        var endDate = startDate.AddDays(span);
        if (roomId.HasValue && !await db.Rooms.AnyAsync(r => r.Id == roomId.Value && r.HotelId == id))
            return null; // nonexistent or foreign room -> 404 from the controller
        var totalRooms = roomId.HasValue ? 1 : await db.Rooms.CountAsync(r => r.HotelId == id);

        var cacheKey = $"hotels:calendar:{id}:{roomId?.ToString() ?? "all"}:{startDate:O}:{span}";
        var cached = await cache.GetAsync<List<CalendarDay>>(cacheKey);
        if (cached is not null) return cached;

        var overlappingQuery = db.Bookings.AsNoTracking()
            .Where(b => b.HotelId == id && b.RoomId != null && b.Status != "cancelled"
                        && b.CheckIn < endDate && b.CheckOut > startDate);
        if (roomId.HasValue) overlappingQuery = overlappingQuery.Where(b => b.RoomId == roomId.Value);
        var overlapping = await overlappingQuery
            .Select(b => new { b.CheckIn, b.CheckOut, RoomId = b.RoomId!.Value })
            .ToListAsync();

        var result = new List<CalendarDay>();
        for (var i = 0; i < span; i++)
        {
            var date = startDate.AddDays(i);
            var blockedToday = overlapping
                .Where(b => b.CheckIn <= date && date < b.CheckOut)
                .Select(b => b.RoomId)
                .Distinct()
                .Count();
            result.Add(new CalendarDay(date.ToString("yyyy-MM-dd"), Math.Max(0, totalRooms - blockedToday), totalRooms));
        }

        await cache.SetAsync(cacheKey, result, 30);
        return result;
    }

    public Task InvalidateCacheAsync() => cache.InvalidatePrefixAsync("hotels:");
}
