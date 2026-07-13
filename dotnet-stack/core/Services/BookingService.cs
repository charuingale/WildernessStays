using System.Data;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using WildernessStays.Core.Contracts;
using WildernessStays.Core.Data;
using WildernessStays.Core.Events;
using WildernessStays.Core.Models;

namespace WildernessStays.Core.Services;

/// <summary>
/// All booking business rules: room-level exclusivity (serializable transaction
/// + row lock), capacity limits, ownership, pricing, CSV export.
/// </summary>
public class BookingService(
    AppDbContext db,
    HotelService hotels,
    PaymentsService payments,
    IBookingEvents events,
    ILogger<BookingService> logger)
{
    private static int Nights(DateOnly checkIn, DateOnly checkOut) => checkOut.DayNumber - checkIn.DayNumber;

    private void AssertOwnership(Booking booking, Guid userId, bool isAdmin)
    {
        if (!isAdmin && booking.UserId != userId)
            throw new ForbiddenException("You can only manage your own bookings");
    }

    private IQueryable<Booking> Filtered(string? search, string? status, Guid? hotelId, Guid? userId)
    {
        var q = db.Bookings.Include(b => b.Hotel).Include(b => b.Room).AsQueryable();
        if (userId.HasValue) q = q.Where(b => b.UserId == userId.Value);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.ToLowerInvariant();
            q = q.Where(b => b.GuestName.ToLower().Contains(s) || b.Email.ToLower().Contains(s)
                             || b.Hotel!.Name.ToLower().Contains(s) || b.Hotel!.Place.ToLower().Contains(s));
        }
        if (!string.IsNullOrWhiteSpace(status)) q = q.Where(b => b.Status == status);
        if (hotelId.HasValue) q = q.Where(b => b.HotelId == hotelId.Value);
        return q.OrderByDescending(b => b.CreatedAt);
    }

    public Task<List<Booking>> FindAllAsync(string? search, string? status, Guid? hotelId, Guid? userId = null) =>
        Filtered(search, status, hotelId, userId).ToListAsync();

    public async Task<Booking> FindOwnedAsync(Guid id, Guid userId, bool isAdmin)
    {
        var booking = await db.Bookings.Include(b => b.Hotel).Include(b => b.Room)
            .FirstOrDefaultAsync(b => b.Id == id)
            ?? throw new NotFoundException("Booking not found");
        AssertOwnership(booking, userId, isAdmin);
        return booking;
    }

    public async Task<Booking> CreateAsync(CreateBookingDto dto, Guid userId)
    {
        var nights = Nights(dto.CheckIn, dto.CheckOut);
        if (nights < 1) throw new DomainValidationException("Check-out must be after check-in");

        Booking booking;
        await using (var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable))
        {
            var hotel = await db.Hotels.FirstOrDefaultAsync(h => h.Id == dto.HotelId)
                ?? throw new NotFoundException("Hotel not found");

            // Row lock on the room: one active reservation blocks it for
            // overlapping dates, while sibling rooms stay bookable.
            var room = await db.Rooms
                .FromSqlInterpolated($"SELECT * FROM rooms WHERE \"Id\" = {dto.RoomId} AND \"HotelId\" = {dto.HotelId} FOR UPDATE")
                .FirstOrDefaultAsync()
                ?? throw new NotFoundException("Room not found at this hotel");

            if (dto.Guests > room.Capacity)
                throw new DomainValidationException($"{room.Name} sleeps up to {room.Capacity} guest(s) — please pick a larger room");

            var clash = await db.Bookings.AnyAsync(b =>
                b.RoomId == dto.RoomId && b.Status != "cancelled"
                && b.CheckIn < dto.CheckOut && b.CheckOut > dto.CheckIn);
            if (clash)
                throw new ConflictException($"{room.Name} at {hotel.Name} is already booked for those dates — pick another room or different dates");

            var totalPrice = room.PricePerNight * nights;
            var (paymentRef, _) = await payments.ChargeAsync(totalPrice,
                $"{hotel.Name} · {room.Name} — {dto.CheckIn:yyyy-MM-dd} to {dto.CheckOut:yyyy-MM-dd}");

            booking = new Booking
            {
                HotelId = dto.HotelId,
                RoomId = dto.RoomId,
                UserId = userId,
                GuestName = dto.GuestName.Trim(),
                Email = dto.Email.Trim(),
                Phone = dto.Phone,
                CheckIn = dto.CheckIn,
                CheckOut = dto.CheckOut,
                Guests = dto.Guests,
                Rooms = 1,
                TotalPrice = totalPrice,
                Status = "confirmed",
                PaymentRef = paymentRef,
                SpecialRequests = dto.SpecialRequests,
            };
            db.Bookings.Add(booking);
            await db.SaveChangesAsync();
            await tx.CommitAsync();
        }

        await hotels.InvalidateCacheAsync();
        var full = await db.Bookings.Include(b => b.Hotel).Include(b => b.Room).FirstAsync(b => b.Id == booking.Id);
        logger.LogInformation("Booking {Id} confirmed for {Guest}", full.Id, full.GuestName);
        await events.BookingCreatedAsync(full);
        await events.AvailabilityChangedAsync(dto.HotelId);
        return full;
    }

    public async Task<Booking> UpdateAsync(Guid id, UpdateBookingDto dto, Guid userId, bool isAdmin)
    {
        var booking = await FindOwnedAsync(id, userId, isAdmin);

        var checkIn = dto.CheckIn ?? booking.CheckIn;
        var checkOut = dto.CheckOut ?? booking.CheckOut;
        var status = dto.Status ?? booking.Status;
        var guests = dto.Guests ?? booking.Guests;
        var nights = Nights(checkIn, checkOut);
        if (nights < 1) throw new DomainValidationException("Check-out must be after check-in");

        if (status != "cancelled" && booking.RoomId.HasValue)
        {
            var clash = await db.Bookings.AnyAsync(b =>
                b.RoomId == booking.RoomId && b.Id != id && b.Status != "cancelled"
                && b.CheckIn < checkOut && b.CheckOut > checkIn);
            if (clash)
                throw new ConflictException($"{booking.Room?.Name ?? "This room"} at {booking.Hotel!.Name} is already booked for those dates");
        }
        if (booking.Room is not null && guests > booking.Room.Capacity)
            throw new DomainValidationException($"{booking.Room.Name} sleeps up to {booking.Room.Capacity} guest(s)");

        booking.GuestName = dto.GuestName?.Trim() ?? booking.GuestName;
        booking.Email = dto.Email?.Trim() ?? booking.Email;
        booking.Phone = dto.Phone ?? booking.Phone;
        booking.CheckIn = checkIn;
        booking.CheckOut = checkOut;
        booking.Guests = guests;
        booking.Status = status;
        booking.SpecialRequests = dto.SpecialRequests ?? booking.SpecialRequests;
        booking.TotalPrice = (booking.Room?.PricePerNight ?? booking.Hotel!.PricePerNight) * nights;
        booking.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        await hotels.InvalidateCacheAsync();
        await events.BookingUpdatedAsync(booking);
        await events.AvailabilityChangedAsync(booking.HotelId);
        return booking;
    }

    public async Task DeleteAsync(Guid id, Guid userId, bool isAdmin)
    {
        var booking = await FindOwnedAsync(id, userId, isAdmin);
        var hotelId = booking.HotelId;
        db.Bookings.Remove(booking);
        await db.SaveChangesAsync();

        await hotels.InvalidateCacheAsync();
        await events.BookingDeletedAsync(id);
        await events.AvailabilityChangedAsync(hotelId);
    }

    public async Task<string> ExportCsvAsync(string? search, string? status)
    {
        var rows = await FindAllAsync(search, status, null);
        static string Esc(object? v) => $"\"{(v?.ToString() ?? "").Replace("\"", "\"\"")}\"";
        var sb = new StringBuilder();
        sb.AppendLine(string.Join(',', "Booking ID", "Hotel", "Room", "Location", "Guest", "Email", "Phone",
            "Check-in", "Check-out", "Guests", "Total (CAD)", "Status", "Payment Ref", "Created"));
        foreach (var b in rows)
        {
            sb.AppendLine(string.Join(',', new[]
            {
                Esc(b.Id), Esc(b.Hotel?.Name), Esc(b.Room?.Name),
                Esc(b.Hotel is null ? "" : $"{b.Hotel.Place}, {b.Hotel.Region}"),
                Esc(b.GuestName), Esc(b.Email), Esc(b.Phone),
                Esc(b.CheckIn.ToString("yyyy-MM-dd")), Esc(b.CheckOut.ToString("yyyy-MM-dd")),
                Esc(b.Guests), Esc(b.TotalPrice.ToString("F2")), Esc(b.Status),
                Esc(b.PaymentRef), Esc(b.CreatedAt.ToString("o")),
            }));
        }
        return sb.ToString();
    }
}
