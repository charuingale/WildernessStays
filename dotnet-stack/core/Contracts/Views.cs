using WildernessStays.Core.Models;

namespace WildernessStays.Core.Contracts;

/// <summary>Read models returned by the business layer (serialized camelCase by the host).</summary>
public record HotelSummary(
    Guid Id, string Name, string Place, string Region, string Description, string RoomDescription,
    decimal PricePerNight, decimal Rating, int RoomsTotal, List<string> Amenities, List<string> Images,
    List<NearbyPlace> NearbyPlaces, DateTime CreatedAt, int RoomsAvailable);

public record RoomView(
    Guid Id, Guid HotelId, string Name, string Description, int Capacity, decimal PricePerNight,
    List<string> Amenities, List<string> Images, bool Available);

public record HotelDetail(
    Guid Id, string Name, string Place, string Region, string Description, string RoomDescription,
    decimal PricePerNight, decimal Rating, int RoomsTotal, List<string> Amenities, List<string> Images,
    List<NearbyPlace> NearbyPlaces, DateTime CreatedAt, int RoomsAvailable, List<RoomView> Rooms);

public record CalendarDay(string Date, int Available, int Total);

public record AuthUser(Guid Id, string Name, string Email, string Role);

public record AuthResult(string Token, AuthUser User);

public record CancellationQuote(
    bool Cancellable, string? Reason, int DaysUntilCheckIn,
    int FeePercent, decimal Fee, decimal Refund, string FreeCancellationUntil);
