using System.Text.Json.Serialization;

namespace WildernessStays.Api.Models;

public class NearbyPlace
{
    public string Name { get; set; } = "";
    public string Distance { get; set; } = "";
    public string Type { get; set; } = "";
}

public class Hotel
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public string Place { get; set; } = "";
    public string Region { get; set; } = "";
    public string Description { get; set; } = "";
    public string RoomDescription { get; set; } = "";
    public decimal PricePerNight { get; set; }
    public decimal Rating { get; set; }
    public int RoomsTotal { get; set; }
    public List<string> Amenities { get; set; } = new();
    public List<string> Images { get; set; } = new();
    public List<NearbyPlace> NearbyPlaces { get; set; } = new();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [JsonIgnore]
    public List<Room> Rooms { get; set; } = new();

    [JsonIgnore]
    public List<Booking> Bookings { get; set; } = new();
}

public class Room
{
    public Guid Id { get; set; }
    public Guid HotelId { get; set; }
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public int Capacity { get; set; } = 2;
    public decimal PricePerNight { get; set; }
    public List<string> Amenities { get; set; } = new();
    public List<string> Images { get; set; } = new();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [JsonIgnore]
    public Hotel? Hotel { get; set; }
}

public class Booking
{
    public Guid Id { get; set; }
    public Guid HotelId { get; set; }
    public Hotel? Hotel { get; set; }
    public Guid? RoomId { get; set; }
    public Room? Room { get; set; }
    public Guid? UserId { get; set; }
    public string GuestName { get; set; } = "";
    public string Email { get; set; } = "";
    public string? Phone { get; set; }
    public DateOnly CheckIn { get; set; }
    public DateOnly CheckOut { get; set; }
    public int Guests { get; set; } = 1;
    public int Rooms { get; set; } = 1;
    public decimal TotalPrice { get; set; }
    public string Status { get; set; } = "confirmed";
    public string? PaymentRef { get; set; }
    public string? SpecialRequests { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class User
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";

    [JsonIgnore]
    public string PasswordHash { get; set; } = "";

    public string Role { get; set; } = "guest";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
