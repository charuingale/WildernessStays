using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using WildernessStays.Core;
using WildernessStays.Core.Contracts;
using WildernessStays.Core.Services;

namespace WildernessStays.Api.Agent;

/// <summary>
/// Declares the tools the concierge can call and executes them against the existing
/// business services. Read tools run immediately; the two write tools
/// (create_booking, cancel_booking) are listed in <see cref="Sensitive"/> and are never
/// executed without explicit guest confirmation — the service enforces that pause.
///
/// Every tool runs as the signed-in guest (userId from the JWT). BookingService/HotelService
/// re-validate availability, capacity and ownership, so the model's arguments are never trusted
/// beyond what that user is already allowed to do.
/// </summary>
public class AgentTools(HotelService hotels, BookingService bookings)
{
    /// <summary>Tools that must be confirmed by the guest before they run.</summary>
    public static readonly HashSet<string> Sensitive = new(StringComparer.Ordinal)
    {
        "create_booking", "cancel_booking",
    };

    private static readonly JsonSerializerOptions J = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    /// <summary>Tool specs in Anthropic tool-use format. Parsed fresh per call to avoid
    /// sharing JsonNode instances (they can only have one parent).</summary>
    public const string SpecsJson = """
    [
      {
        "name": "search_lodges",
        "description": "Search available lodges by destination, budget and dates. Returns a short list with ids you can pass to other tools. Use this before recommending or booking anything — never invent lodge or room ids.",
        "input_schema": {
          "type": "object",
          "properties": {
            "place": { "type": "string", "description": "Destination or region, e.g. 'Banff'. Omit for anywhere." },
            "maxPrice": { "type": "number", "description": "Maximum nightly price in CAD (a ceiling, not a bracket)." },
            "checkIn": { "type": "string", "description": "Check-in date, YYYY-MM-DD." },
            "checkOut": { "type": "string", "description": "Check-out date, YYYY-MM-DD." },
            "guests": { "type": "integer", "description": "Number of guests." }
          }
        }
      },
      {
        "name": "get_lodge_details",
        "description": "Get one lodge with its rooms, per-room capacity, nightly price and availability for the given dates. Use this to pick a specific roomId before booking.",
        "input_schema": {
          "type": "object",
          "properties": {
            "hotelId": { "type": "string", "description": "Lodge id (GUID) from search_lodges." },
            "checkIn": { "type": "string", "description": "Check-in date, YYYY-MM-DD." },
            "checkOut": { "type": "string", "description": "Check-out date, YYYY-MM-DD." }
          },
          "required": ["hotelId"]
        }
      },
      {
        "name": "list_my_bookings",
        "description": "List the current guest's own bookings, with status and dates. Use this to find a bookingId before quoting or cancelling.",
        "input_schema": { "type": "object", "properties": {} }
      },
      {
        "name": "get_cancellation_quote",
        "description": "Preview the refund and fee for cancelling one of the guest's bookings today, under the policy (free until 7 days before check-in, then a 70% fee).",
        "input_schema": {
          "type": "object",
          "properties": { "bookingId": { "type": "string", "description": "Booking id (GUID)." } },
          "required": ["bookingId"]
        }
      },
      {
        "name": "create_booking",
        "description": "Book a specific room for the guest. SENSITIVE: this charges and reserves. Always gather details with search_lodges/get_lodge_details first and confirm with the guest; the system will also require explicit confirmation before it runs.",
        "input_schema": {
          "type": "object",
          "properties": {
            "hotelId": { "type": "string", "description": "Lodge id (GUID)." },
            "roomId": { "type": "string", "description": "Room id (GUID) from get_lodge_details." },
            "checkIn": { "type": "string", "description": "Check-in date, YYYY-MM-DD." },
            "checkOut": { "type": "string", "description": "Check-out date, YYYY-MM-DD." },
            "guests": { "type": "integer", "description": "Number of guests (must fit room capacity)." },
            "guestName": { "type": "string", "description": "Lead guest's full name." },
            "email": { "type": "string", "description": "Contact email for the reservation." },
            "phone": { "type": "string", "description": "Optional contact phone." },
            "specialRequests": { "type": "string", "description": "Optional notes for the lodge." }
          },
          "required": ["hotelId", "roomId", "checkIn", "checkOut", "guests", "guestName", "email"]
        }
      },
      {
        "name": "cancel_booking",
        "description": "Cancel one of the guest's bookings under the policy. SENSITIVE: this refunds and frees the room. The system will require explicit confirmation before it runs.",
        "input_schema": {
          "type": "object",
          "properties": { "bookingId": { "type": "string", "description": "Booking id (GUID)." } },
          "required": ["bookingId"]
        }
      }
    ]
    """;

    // ---- argument shapes (deserialized from the model's tool input) ----
    private record SearchArgs(string? Place, decimal? MaxPrice, string? CheckIn, string? CheckOut, int? Guests);
    private record LodgeArgs(string? HotelId, string? CheckIn, string? CheckOut);
    private record BookingIdArgs(string? BookingId);
    private record CreateArgs(string? HotelId, string? RoomId, string? CheckIn, string? CheckOut,
        int Guests, string? GuestName, string? Email, string? Phone, string? SpecialRequests);

    private static DateOnly? Date(string? s) =>
        string.IsNullOrWhiteSpace(s) ? null : DateOnly.Parse(s, CultureInfo.InvariantCulture);

    private static Guid Id(string? s, string field) =>
        Guid.TryParse(s, out var g) ? g : throw new DomainValidationException($"'{field}' must be a valid id");

    private static (DateOnly ci, DateOnly co) Range(string? checkIn, string? checkOut)
    {
        var ci = Date(checkIn) ?? DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1);
        var co = Date(checkOut) ?? ci.AddDays(2);
        return (ci, co);
    }

    private static string Json(object o) => JsonSerializer.Serialize(o, J);

    /// <summary>
    /// Run a tool. Returns the JSON string handed back to the model and whether it is an error
    /// (domain/validation failures are returned as tool errors so the model can recover gracefully,
    /// rather than crashing the request).
    /// </summary>
    public async Task<(string Json, bool IsError)> ExecuteAsync(
        string name, JsonNode? input, Guid userId, bool isAdmin, CancellationToken ct)
    {
        try
        {
            return (await RunAsync(name, input, userId, isAdmin, ct), false);
        }
        catch (ApiException ex)            // NotFound / Conflict / Validation / Forbidden from the core layer
        {
            return (Json(new { error = ex.Message }), true);
        }
        catch (FormatException ex)         // bad date/number the schema didn't catch
        {
            return (Json(new { error = ex.Message }), true);
        }
    }

    private async Task<string> RunAsync(string name, JsonNode? input, Guid userId, bool isAdmin, CancellationToken ct)
    {
        input ??= new JsonObject();   // models send {} for no-arg tools, but never trust that
        switch (name)
        {
            case "search_lodges":
            {
                var a = input.Deserialize<SearchArgs>(J) ?? new SearchArgs(null, null, null, null, null);
                var (ci, co) = Range(a.CheckIn, a.CheckOut);
                var list = await hotels.FindAllAsync(a.Place, null, a.MaxPrice, availableOnly: true, ci, co);
                var top = list.Take(8).Select(h => new
                {
                    hotelId = h.Id, h.Name, h.Place, h.Region,
                    pricePerNight = h.PricePerNight, h.Rating, h.RoomsAvailable,
                });
                return Json(new { count = list.Count, results = top });
            }

            case "get_lodge_details":
            {
                var a = input.Deserialize<LodgeArgs>(J)!;
                var (ci, co) = Range(a.CheckIn, a.CheckOut);
                var d = await hotels.FindOneAsync(Id(a.HotelId, "hotelId"), ci, co);
                if (d is null) return Json(new { error = "Lodge not found" });
                return Json(new
                {
                    hotelId = d.Id, d.Name, d.Place, d.Region, pricePerNight = d.PricePerNight,
                    rooms = d.Rooms.Select(r => new
                    {
                        roomId = r.Id, r.Name, r.Capacity, pricePerNight = r.PricePerNight, r.Available,
                    }),
                });
            }

            case "list_my_bookings":
            {
                var mine = await bookings.FindAllAsync(null, null, null, userId);
                return Json(new
                {
                    bookings = mine.Select(b => new
                    {
                        bookingId = b.Id, hotel = b.Hotel?.Name, room = b.Room?.Name,
                        b.CheckIn, b.CheckOut, b.Status, b.Guests, total = b.TotalPrice,
                    }),
                });
            }

            case "get_cancellation_quote":
            {
                var a = input.Deserialize<BookingIdArgs>(J)!;
                var q = await bookings.QuoteAsync(Id(a.BookingId, "bookingId"), userId, isAdmin);
                return Json(q);
            }

            case "create_booking":
            {
                var a = input.Deserialize<CreateArgs>(J)!;
                var dto = new CreateBookingDto
                {
                    HotelId = Id(a.HotelId, "hotelId"),
                    RoomId = Id(a.RoomId, "roomId"),
                    GuestName = a.GuestName ?? "",
                    Email = a.Email ?? "",
                    Phone = a.Phone,
                    CheckIn = Date(a.CheckIn) ?? throw new DomainValidationException("checkIn is required"),
                    CheckOut = Date(a.CheckOut) ?? throw new DomainValidationException("checkOut is required"),
                    Guests = a.Guests,
                    SpecialRequests = a.SpecialRequests,
                };
                var b = await bookings.CreateAsync(dto, userId);
                return Json(new
                {
                    booked = true, bookingId = b.Id, b.Status, total = b.TotalPrice,
                    hotel = b.Hotel?.Name, room = b.Room?.Name, b.CheckIn, b.CheckOut,
                });
            }

            case "cancel_booking":
            {
                var a = input.Deserialize<BookingIdArgs>(J)!;
                var b = await bookings.CancelAsync(Id(a.BookingId, "bookingId"), userId, isAdmin);
                return Json(new
                {
                    cancelled = true, bookingId = b.Id, b.Status,
                    refund = b.RefundAmount, fee = b.CancellationFee,
                });
            }

            default:
                return Json(new { error = $"Unknown tool '{name}'" });
        }
    }

    /// <summary>
    /// Build the confirmation card for a sensitive action, with real figures fetched from the
    /// domain (estimated total for a booking; refund/fee for a cancellation). Runs before the
    /// action itself, so the guest sees accurate numbers before approving.
    /// </summary>
    public async Task<PendingAction> DescribeAsync(
        string name, JsonNode? input, Guid userId, bool isAdmin, CancellationToken ct)
    {
        if (name == "create_booking")
        {
            var a = input.Deserialize<CreateArgs>(J)!;
            var (ci, co) = Range(a.CheckIn, a.CheckOut);
            var nights = Math.Max(1, co.DayNumber - ci.DayNumber);
            string lodge = a.HotelId ?? "", room = a.RoomId ?? "";
            decimal? est = null;
            try
            {
                var d = await hotels.FindOneAsync(Id(a.HotelId, "hotelId"), ci, co);
                var r = d?.Rooms.FirstOrDefault(x => x.Id.ToString() == a.RoomId);
                if (d is not null) lodge = d.Name;
                if (r is not null) { room = r.Name; est = r.PricePerNight * nights; }
            }
            catch (ApiException) { /* fall back to raw ids in the summary */ }

            var price = est is null ? "" : $" · est. {est.Value:C} CAD for {nights} night(s)";
            return new PendingAction("create_booking",
                $"Book {room} at {lodge} · {ci:yyyy-MM-dd} → {co:yyyy-MM-dd} · {a.Guests} guest(s){price}",
                new { lodge, room, checkIn = ci.ToString("yyyy-MM-dd"), checkOut = co.ToString("yyyy-MM-dd"),
                      guests = a.Guests, guestName = a.GuestName, estimatedTotal = est },
                ResumeToken: "");
        }

        if (name == "cancel_booking")
        {
            var a = input.Deserialize<BookingIdArgs>(J)!;
            try
            {
                var q = await bookings.QuoteAsync(Id(a.BookingId, "bookingId"), userId, isAdmin);
                var summary = q.Cancellable
                    ? $"Cancel this booking · refund {q.Refund:C} CAD, fee {q.Fee:C} CAD ({q.FeePercent}%)"
                    : $"This booking can't be cancelled: {q.Reason}";
                return new PendingAction("cancel_booking", summary,
                    new { bookingId = a.BookingId, q.Cancellable, q.Refund, q.Fee, q.FeePercent, q.Reason },
                    ResumeToken: "");
            }
            catch (ApiException ex)
            {
                return new PendingAction("cancel_booking", $"Cancel this booking — {ex.Message}",
                    new { bookingId = a.BookingId, error = ex.Message }, ResumeToken: "");
            }
        }

        return new PendingAction(name, $"Confirm action: {name}", new { }, ResumeToken: "");
    }
}
