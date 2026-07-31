using System.ComponentModel;
using System.Globalization;
using System.Text.Json;
using ModelContextProtocol.Server;
using WildernessStays.Core.Services;

namespace WildernessStays.Api.Mcp;

/// <summary>
/// Read-only MCP tools exposing Wilderness Stays lodge search to any MCP client
/// (Claude Desktop, MCP Inspector, etc.). These wrap the existing <see cref="HotelService"/>,
/// so an external AI can browse availability without us building an AI of our own.
///
/// Read-only by design: no auth, no writes. Booking tools (which need a signed-in user)
/// come later.
/// </summary>
[McpServerToolType]
public static class LodgeMcpTools
{
    private static readonly JsonSerializerOptions J = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    private static DateOnly? Date(string? s) =>
        string.IsNullOrWhiteSpace(s) ? null : DateOnly.Parse(s, CultureInfo.InvariantCulture);

    /// <summary>Default to a 2-night stay starting tomorrow when the caller omits dates.</summary>
    private static (DateOnly ci, DateOnly co) Range(string? checkIn, string? checkOut)
    {
        var ci = Date(checkIn) ?? DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1);
        var co = Date(checkOut) ?? ci.AddDays(2);
        return (ci, co);
    }

    [McpServerTool(Name = "search_lodges")]
    [Description("Search available Wilderness Stays lodges by destination, budget and dates. " +
                 "Returns a short list of lodges with their ids, price and rooms available.")]
    public static async Task<string> SearchLodges(
        HotelService hotels,
        [Description("Destination or region, e.g. 'Banff'. Omit for anywhere.")] string? place = null,
        [Description("Maximum nightly price in CAD (a ceiling, not a bracket).")] decimal? maxPrice = null,
        [Description("Check-in date, YYYY-MM-DD. Optional.")] string? checkIn = null,
        [Description("Check-out date, YYYY-MM-DD. Optional.")] string? checkOut = null)
    {
        var (ci, co) = Range(checkIn, checkOut);
        var list = await hotels.FindAllAsync(place, null, maxPrice, availableOnly: true, ci, co);
        var results = list.Take(8).Select(h => new
        {
            hotelId = h.Id, h.Name, h.Place, h.Region,
            pricePerNight = h.PricePerNight, h.Rating, h.RoomsAvailable,
        });
        return JsonSerializer.Serialize(new { count = list.Count, results }, J);
    }

    [McpServerTool(Name = "get_lodge_details")]
    [Description("Get one lodge with its rooms, per-room capacity, nightly price and availability " +
                 "for the given dates. Use a hotelId returned by search_lodges.")]
    public static async Task<string> GetLodgeDetails(
        HotelService hotels,
        [Description("Lodge id (GUID) from search_lodges.")] string hotelId,
        [Description("Check-in date, YYYY-MM-DD. Optional.")] string? checkIn = null,
        [Description("Check-out date, YYYY-MM-DD. Optional.")] string? checkOut = null)
    {
        if (!Guid.TryParse(hotelId, out var id))
            return JsonSerializer.Serialize(new { error = "hotelId must be a valid id" }, J);

        var (ci, co) = Range(checkIn, checkOut);
        var d = await hotels.FindOneAsync(id, ci, co);
        if (d is null)
            return JsonSerializer.Serialize(new { error = "Lodge not found" }, J);

        return JsonSerializer.Serialize(new
        {
            hotelId = d.Id, d.Name, d.Place, d.Region, pricePerNight = d.PricePerNight,
            rooms = d.Rooms.Select(r => new
            {
                roomId = r.Id, r.Name, r.Capacity, pricePerNight = r.PricePerNight, r.Available,
            }),
        }, J);
    }
}
