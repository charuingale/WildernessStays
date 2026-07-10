using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using WildernessStays.Api.Models;
using WildernessStays.Api.Services;

namespace WildernessStays.Api.Data;

public static class Seeder
{
    private record SeedRoom(string Name, string Description, int Capacity, decimal PricePerNight,
        List<string> Amenities, List<string> Images);

    private record SeedHotel(string Name, string Place, string Region, decimal PricePerNight, decimal Rating,
        int RoomsTotal, string Description, string RoomDescription, List<string> Amenities, List<string> Images,
        List<NearbyPlace> NearbyPlaces, List<SeedRoom> Rooms);

    public static async Task RunAsync(AppDbContext db, ILogger logger)
    {
        await db.Database.EnsureCreatedAsync();

        // Always guarantee the demo accounts exist (parity with the Node backend).
        if (!await db.Users.AnyAsync(u => u.Email == "admin@wilderness.ca"))
        {
            db.Users.Add(new User
            {
                Name = "Lodge Manager",
                Email = "admin@wilderness.ca",
                PasswordHash = PasswordService.Hash("admin123"),
                Role = "admin",
            });
            await db.SaveChangesAsync();
            logger.LogInformation("Seeded admin account: admin@wilderness.ca / admin123");
        }
        if (!await db.Users.AnyAsync(u => u.Email == "guest@example.com"))
        {
            db.Users.Add(new User
            {
                Name = "Maya Desai",
                Email = "guest@example.com",
                PasswordHash = PasswordService.Hash("guest123"),
                Role = "guest",
            });
            await db.SaveChangesAsync();
            logger.LogInformation("Seeded guest account: guest@example.com / guest123");
        }

        if (await db.Hotels.AnyAsync()) return; // hotels already seeded

        var path = Path.Combine(AppContext.BaseDirectory, "Data", "hotels.json");
        if (!File.Exists(path)) path = Path.Combine(Directory.GetCurrentDirectory(), "Data", "hotels.json");
        var json = await File.ReadAllTextAsync(path);
        var seeds = JsonSerializer.Deserialize<List<SeedHotel>>(json,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;

        var guest = await db.Users.FirstAsync(u => u.Email == "guest@example.com");
        var savedHotels = new List<Hotel>();
        var roomsByHotel = new Dictionary<Guid, List<Room>>();

        foreach (var s in seeds)
        {
            var hotel = new Hotel
            {
                Name = s.Name, Place = s.Place, Region = s.Region,
                Description = s.Description, RoomDescription = s.RoomDescription,
                PricePerNight = s.PricePerNight, Rating = s.Rating, RoomsTotal = s.RoomsTotal,
                Amenities = s.Amenities, Images = s.Images, NearbyPlaces = s.NearbyPlaces,
            };
            db.Hotels.Add(hotel);
            await db.SaveChangesAsync();
            savedHotels.Add(hotel);

            var rooms = s.Rooms.Select(r => new Room
            {
                HotelId = hotel.Id, Name = r.Name, Description = r.Description,
                Capacity = r.Capacity, PricePerNight = r.PricePerNight,
                Amenities = r.Amenities, Images = r.Images,
            }).ToList();
            db.Rooms.AddRange(rooms);
            await db.SaveChangesAsync();
            roomsByHotel[hotel.Id] = rooms;
        }
        logger.LogInformation("Seeded {Hotels} hotels with {Rooms} rooms",
            savedHotels.Count, roomsByHotel.Values.Sum(r => r.Count));

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var samples = new (int HotelIdx, string Guest, string Email, string Phone, int InDays, int Nights, int Guests, string Status, string Requests)[]
        {
            (0, "Maya Desai", "maya.desai@example.com", "+1 403 555 0142", 3, 4, 2, "confirmed", "High floor with a mountain view, please."),
            (1, "Liam Tremblay", "liam.t@example.com", "+1 514 555 0179", 10, 3, 2, "confirmed", "Anniversary trip — late checkout if possible."),
            (3, "Sofia Martins", "sofia.m@example.com", "+1 604 555 0114", 1, 5, 4, "pending", ""),
            (4, "Noah Campbell", "noah.c@example.com", "+1 250 555 0186", 21, 2, 2, "confirmed", "Storm-watching season — ocean-facing room."),
            (6, "Émile Roy", "emile.roy@example.com", "+1 819 555 0133", -6, 3, 3, "cancelled", ""),
        };
        foreach (var s in samples)
        {
            var hotel = savedHotels[s.HotelIdx];
            var rooms = roomsByHotel[hotel.Id];
            var room = rooms[Math.Min(1, rooms.Count - 1)];
            db.Bookings.Add(new Booking
            {
                HotelId = hotel.Id,
                RoomId = room.Id,
                UserId = guest.Id,
                GuestName = s.Guest,
                Email = s.Email,
                Phone = s.Phone,
                CheckIn = today.AddDays(s.InDays),
                CheckOut = today.AddDays(s.InDays + s.Nights),
                Guests = s.Guests,
                Rooms = 1,
                TotalPrice = room.PricePerNight * s.Nights,
                Status = s.Status,
                PaymentRef = $"mock_pi_seed_{Guid.NewGuid().ToString("N")[..8]}",
                SpecialRequests = string.IsNullOrEmpty(s.Requests) ? null : s.Requests,
            });
        }
        await db.SaveChangesAsync();
        logger.LogInformation("Seeded {Count} sample bookings", samples.Length);
    }
}
