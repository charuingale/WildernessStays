using Microsoft.AspNetCore.SignalR;
using WildernessStays.Core.Events;

namespace WildernessStays.Api.Hubs;

/// <summary>
/// Real-time channel. Event names match the Node backend's Socket.IO contract:
/// booking.created / booking.updated / booking.deleted / availability.changed
/// </summary>
public class EventsHub : Hub;

/// <summary>Bridges the core library's business events onto SignalR.</summary>
public class SignalRBookingEvents(IHubContext<EventsHub> hub) : IBookingEvents
{
    public Task BookingCreatedAsync(object booking) => hub.Clients.All.SendAsync("booking.created", booking);
    public Task BookingUpdatedAsync(object booking) => hub.Clients.All.SendAsync("booking.updated", booking);
    public Task BookingDeletedAsync(Guid id) => hub.Clients.All.SendAsync("booking.deleted", new { id });
    public Task AvailabilityChangedAsync(Guid hotelId) => hub.Clients.All.SendAsync("availability.changed", new { hotelId });
}
