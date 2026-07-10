using System.Data;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using WildernessStays.Api.Data;
using WildernessStays.Api.Dtos;
using WildernessStays.Api.Hubs;
using WildernessStays.Api.Models;
using WildernessStays.Api.Services;

namespace WildernessStays.Api.Controllers;

[ApiController]
[Route("api/bookings")]
[Authorize]
public class BookingsController(
    AppDbContext db,
    CacheService cache,
    PaymentsService payments,
    IHubContext<EventsHub> events) : ControllerBase
{
    private Guid CurrentUserId => Guid.Parse(User.FindFirst("sub")!.Value);
    private bool IsAdmin => User.FindFirst("role")?.Value == "admin";

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

    private static int Nights(DateOnly checkIn, DateOnly checkOut) =>
        checkOut.DayNumber - checkIn.DayNumber;

    private async Task BroadcastAsync(string eventName, object? payload) =>
        await events.Clients.All.SendAsync(eventName, payload);

    [HttpGet]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> FindAll([FromQuery] string? search, [FromQuery] string? status, [FromQuery] Guid? hotelId) =>
        Ok(await Filtered(search, status, hotelId, null).ToListAsync());

    [HttpGet("mine")]
    public async Task<IActionResult> FindMine([FromQuery] string? search, [FromQuery] string? status) =>
        Ok(await Filtered(search, status, null, CurrentUserId).ToListAsync());

    [HttpGet("export/csv")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> ExportCsv([FromQuery] string? search, [FromQuery] string? status)
    {
        var rows = await Filtered(search, status, null, null).ToListAsync();
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
        return File(Encoding.UTF8.GetBytes(sb.ToString()), "text/csv",
            $"bookings-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}.csv");
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> FindOne(Guid id)
    {
        var booking = await db.Bookings.Include(b => b.Hotel).Include(b => b.Room)
            .FirstOrDefaultAsync(b => b.Id == id);
        if (booking is null) return NotFound(new { message = "Booking not found" });
        if (!IsAdmin && booking.UserId != CurrentUserId)
            return StatusCode(403, new { message = "You can only manage your own bookings" });
        return Ok(booking);
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateBookingDto dto)
    {
        var nights = Nights(dto.CheckIn, dto.CheckOut);
        if (nights < 1) return BadRequest(new { message = "Check-out must be after check-in" });

        Booking booking;
        await using (var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable))
        {
            var hotel = await db.Hotels.FirstOrDefaultAsync(h => h.Id == dto.HotelId);
            if (hotel is null) return NotFound(new { message = "Hotel not found" });

            // Row lock on the room: one active reservation blocks it for
            // overlapping dates, while sibling rooms stay bookable.
            var room = await db.Rooms
                .FromSqlInterpolated($"SELECT * FROM rooms WHERE \"Id\" = {dto.RoomId} AND \"HotelId\" = {dto.HotelId} FOR UPDATE")
                .FirstOrDefaultAsync();
            if (room is null) return NotFound(new { message = "Room not found at this hotel" });

            if (dto.Guests > room.Capacity)
                return BadRequest(new { message = $"{room.Name} sleeps up to {room.Capacity} guest(s) — please pick a larger room" });

            var clash = await db.Bookings.AnyAsync(b =>
                b.RoomId == dto.RoomId && b.Status != "cancelled"
                && b.CheckIn < dto.CheckOut && b.CheckOut > dto.CheckIn);
            if (clash)
                return Conflict(new { message = $"{room.Name} at {hotel.Name} is already booked for those dates — pick another room or different dates" });

            var totalPrice = room.PricePerNight * nights;
            var (paymentRef, _) = await payments.ChargeAsync(totalPrice,
                $"{hotel.Name} · {room.Name} — {dto.CheckIn:yyyy-MM-dd} to {dto.CheckOut:yyyy-MM-dd}");

            booking = new Booking
            {
                HotelId = dto.HotelId,
                RoomId = dto.RoomId,
                UserId = CurrentUserId,
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

        await cache.InvalidatePrefixAsync("hotels:");
        var full = await db.Bookings.Include(b => b.Hotel).Include(b => b.Room).FirstAsync(b => b.Id == booking.Id);
        await BroadcastAsync("booking.created", full);
        await BroadcastAsync("availability.changed", new { hotelId = dto.HotelId });
        return StatusCode(201, full);
    }

    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, UpdateBookingDto dto)
    {
        var booking = await db.Bookings.Include(b => b.Hotel).Include(b => b.Room)
            .FirstOrDefaultAsync(b => b.Id == id);
        if (booking is null) return NotFound(new { message = "Booking not found" });
        if (!IsAdmin && booking.UserId != CurrentUserId)
            return StatusCode(403, new { message = "You can only manage your own bookings" });

        var checkIn = dto.CheckIn ?? booking.CheckIn;
        var checkOut = dto.CheckOut ?? booking.CheckOut;
        var status = dto.Status ?? booking.Status;
        var guests = dto.Guests ?? booking.Guests;
        var nights = Nights(checkIn, checkOut);
        if (nights < 1) return BadRequest(new { message = "Check-out must be after check-in" });

        if (status != "cancelled" && booking.RoomId.HasValue)
        {
            var clash = await db.Bookings.AnyAsync(b =>
                b.RoomId == booking.RoomId && b.Id != id && b.Status != "cancelled"
                && b.CheckIn < checkOut && b.CheckOut > checkIn);
            if (clash)
                return Conflict(new { message = $"{booking.Room?.Name ?? "This room"} at {booking.Hotel!.Name} is already booked for those dates" });
        }
        if (booking.Room is not null && guests > booking.Room.Capacity)
            return BadRequest(new { message = $"{booking.Room.Name} sleeps up to {booking.Room.Capacity} guest(s)" });

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

        await cache.InvalidatePrefixAsync("hotels:");
        await BroadcastAsync("booking.updated", booking);
        await BroadcastAsync("availability.changed", new { hotelId = booking.HotelId });
        return Ok(booking);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Remove(Guid id)
    {
        var booking = await db.Bookings.FirstOrDefaultAsync(b => b.Id == id);
        if (booking is null) return NotFound(new { message = "Booking not found" });
        if (!IsAdmin && booking.UserId != CurrentUserId)
            return StatusCode(403, new { message = "You can only manage your own bookings" });

        var hotelId = booking.HotelId;
        db.Bookings.Remove(booking);
        await db.SaveChangesAsync();

        await cache.InvalidatePrefixAsync("hotels:");
        await BroadcastAsync("booking.deleted", new { id });
        await BroadcastAsync("availability.changed", new { hotelId });
        return Ok(new { deleted = true });
    }
}
