using Microsoft.AspNetCore.SignalR;

namespace WildernessStays.Api.Hubs;

/// <summary>
/// Real-time channel. Controllers broadcast through IHubContext&lt;EventsHub&gt;
/// with the same event names the Node backend uses over Socket.IO:
/// booking.created / booking.updated / booking.deleted / availability.changed
/// </summary>
public class EventsHub : Hub;
