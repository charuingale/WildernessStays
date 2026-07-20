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

    /// <summary>Minimal payload for realtime broadcasts — no guest PII or payment refs.</summary>
    private static object EventView(Booking b) =>
        new { id = b.Id, hotelId = b.HotelId, roomId = b.RoomId, status = b.Status, checkIn = b.CheckIn, checkOut = b.CheckOut };

    /// <summary>Event publication is best-effort: a broken realtime channel must not fail a committed operation.</summary>
    private async Task NotifyAsync(Func<Task> send)
    {
        try { await send(); }
        catch (Exception ex) { logger.LogWarning(ex, "Realtime notification failed (ignored)"); }
    }

    /// <summary>Cancellation policy: free until 7 days before check-in, then a 70% fee.</summary>
    public const int FreeCancellationDaysBefore = 7;
    public const int LateCancellationFeePercent = 70;

    public static CancellationQuote QuoteFor(Booking booking)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var daysUntil = booking.CheckIn.DayNumber - today.DayNumber;
        var freeUntil = booking.CheckIn.AddDays(-FreeCancellationDaysBefore).ToString("yyyy-MM-dd");

        if (booking.Status == "cancelled")
            return new CancellationQuote(false, "This booking is already cancelled", daysUntil, 0, 0, 0, freeUntil);
        if (daysUntil < 1)
            return new CancellationQuote(false, "Bookings cannot be cancelled on or after the check-in date", daysUntil, 0, 0, 0, freeUntil);

        var feePercent = daysUntil >= FreeCancellationDaysBefore ? 0 : LateCancellationFeePercent;
        var fee = Math.Round(booking.TotalPrice * feePercent / 100m, 2);
        return new CancellationQuote(true, null, daysUntil, feePercent, fee,
            Math.Round(booking.TotalPrice - fee, 2), freeUntil);
    }

    public async Task<CancellationQuote> QuoteAsync(Guid id, Guid userId, bool isAdmin) =>
        QuoteFor(await FindOwnedAsync(id, userId, isAdmin));

    /// <summary>
    /// Cancel under the policy: refund what's due, keep the fee, free the room.
    /// Runs in a transaction with the booking row locked so concurrent cancel
    /// requests are serialized (only one can refund), and the refund carries a
    /// stable idempotency key derived from the booking id.
    /// </summary>
    public async Task<Booking> CancelAsync(Guid id, Guid userId, bool isAdmin)
    {
        var pre = await FindOwnedAsync(id, userId, isAdmin);

        await using (var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable))
        {
            var booking = await db.Bookings
                .FromSqlInterpolated($"SELECT * FROM bookings WHERE \"Id\" = {id} FOR UPDATE")
                .FirstOrDefaultAsync()
                ?? throw new NotFoundException("Booking not found");

            var quote = QuoteFor(booking);
            if (!quote.Cancellable) throw new DomainValidationException(quote.Reason!);

            var (refundRef, _) = await payments.RefundAsync(quote.Refund, booking.PaymentRef, $"cancel-{id}");
            booking.Status = "cancelled";
            booking.CancelledAt = DateTime.UtcNow;
            booking.CancellationFee = quote.Fee;
            booking.RefundAmount = quote.Refund;
            booking.RefundRef = refundRef;
            booking.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
            await tx.CommitAsync();
            logger.LogInformation("Booking {Id} cancelled — refunded {Refund:F2}, fee {Fee:F2}", id, quote.Refund, quote.Fee);
        }

        await hotels.InvalidateCacheAsync();
        var full = await db.Bookings.Include(b => b.Hotel).Include(b => b.Room).FirstAsync(b => b.Id == id);
        await NotifyAsync(() => events.BookingUpdatedAsync(EventView(full)));
        await NotifyAsync(() => events.AvailabilityChangedAsync(full.HotelId));
        return full;
    }

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
        await NotifyAsync(() => events.BookingCreatedAsync(EventView(full)));
        await NotifyAsync(() => events.AvailabilityChangedAsync(dto.HotelId));
        return full;
    }

    public async Task<Booking> UpdateAsync(Guid id, UpdateBookingDto dto, Guid userId, bool isAdmin)
    {
        var booking = await FindOwnedAsync(id, userId, isAdmin);

        // Cancellations always go through the policy, even via PATCH.
        if (dto.Status == "cancelled" && booking.Status != "cancelled")
            return await CancelAsync(id, userId, isAdmin);

        // A cancelled booking has been refunded — reactivating it for free would
        // be an unpaid stay. Rebooking means making a new reservation.
        if (booking.Status == "cancelled" && dto.Status is not null && dto.Status != "cancelled")
            throw new DomainValidationException("Cancelled bookings cannot be reactivated — please make a new reservation");

        // Completed stays are immutable history for guests (admins may still correct records).
        if (!isAdmin && booking.CheckOut < DateOnly.FromDateTime(DateTime.UtcNow))
            throw new DomainValidationException("This stay is in the past and can no longer be changed");

        var checkIn = dto.CheckIn ?? booking.CheckIn;
        var checkOut = dto.CheckOut ?? booking.CheckOut;
        var status = dto.Status ?? booking.Status;
        var guests = dto.Guests ?? booking.Guests;
        var nights = Nights(checkIn, checkOut);
        if (nights < 1) throw new DomainValidationException("Check-out must be after check-in");

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

        if (status != "cancelled" && booking.RoomId.HasValue)
        {
            // Clash check and save run with the room row locked, so two concurrent
            // reschedules cannot both pass (same guarantee as CreateAsync).
            await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            await db.Rooms
                .FromSqlInterpolated($"SELECT * FROM rooms WHERE \"Id\" = {booking.RoomId.Value} FOR UPDATE")
                .FirstOrDefaultAsync();
            var clash = await db.Bookings.AnyAsync(b =>
                b.RoomId == booking.RoomId && b.Id != id && b.Status != "cancelled"
                && b.CheckIn < checkOut && b.CheckOut > checkIn);
            if (clash)
                throw new ConflictException($"{booking.Room?.Name ?? "This room"} at {booking.Hotel!.Name} is already booked for those dates");
            await db.SaveChangesAsync();
            await tx.CommitAsync();
        }
        else
        {
            await db.SaveChangesAsync();
        }

        await hotels.InvalidateCacheAsync();
        await NotifyAsync(() => events.BookingUpdatedAsync(EventView(booking)));
        await NotifyAsync(() => events.AvailabilityChangedAsync(booking.HotelId));
        return booking;
    }

    public async Task DeleteAsync(Guid id, Guid userId, bool isAdmin)
    {
        var booking = await FindOwnedAsync(id, userId, isAdmin);
        var hotelId = booking.HotelId;
        db.Bookings.Remove(booking);
        await db.SaveChangesAsync();

        await hotels.InvalidateCacheAsync();
        await NotifyAsync(() => events.BookingDeletedAsync(id));
        await NotifyAsync(() => events.AvailabilityChangedAsync(hotelId));
    }

    public async Task<string> ExportCsvAsync(string? search, string? status)
    {
        var rows = await FindAllAsync(search, status, null);
        static string Esc(object? v)
        {
            var text = v?.ToString() ?? "";
            // Neutralize spreadsheet formula injection (OWASP CSV injection)
            if (text.Length > 0 && text[0] is '=' or '+' or '-' or '@') text = "'" + text;
            return $"\"{text.Replace("\"", "\"\"")}\"";
        }
        var sb = new StringBuilder();
        sb.AppendLine(string.Join(',', "Booking ID", "Hotel", "Room", "Location", "Guest", "Email", "Phone",
            "Check-in", "Check-out", "Guests", "Total (CAD)", "Status", "Cancellation Fee", "Refund", "Payment Ref", "Created"));
        foreach (var b in rows)
        {
            sb.AppendLine(string.Join(',', new[]
            {
                Esc(b.Id), Esc(b.Hotel?.Name), Esc(b.Room?.Name),
                Esc(b.Hotel is null ? "" : $"{b.Hotel.Place}, {b.Hotel.Region}"),
                Esc(b.GuestName), Esc(b.Email), Esc(b.Phone),
                Esc(b.CheckIn.ToString("yyyy-MM-dd")), Esc(b.CheckOut.ToString("yyyy-MM-dd")),
                Esc(b.Guests), Esc(b.TotalPrice.ToString("F2")), Esc(b.Status),
                Esc(b.CancellationFee?.ToString("F2")), Esc(b.RefundAmount?.ToString("F2")),
                Esc(b.PaymentRef), Esc(b.CreatedAt.ToString("o")),
            }));
        }
        return sb.ToString();
    }
}
