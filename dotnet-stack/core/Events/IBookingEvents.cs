namespace WildernessStays.Core.Events;

/// <summary>
/// Outbound real-time notifications raised by the business layer.
/// The host supplies the transport (e.g. SignalR); when it doesn't,
/// <see cref="NullBookingEvents"/> keeps the library self-sufficient.
/// </summary>
public interface IBookingEvents
{
    Task BookingCreatedAsync(object booking);
    Task BookingUpdatedAsync(object booking);
    Task BookingDeletedAsync(Guid id);
    Task AvailabilityChangedAsync(Guid hotelId);
}

public sealed class NullBookingEvents : IBookingEvents
{
    public Task BookingCreatedAsync(object booking) => Task.CompletedTask;
    public Task BookingUpdatedAsync(object booking) => Task.CompletedTask;
    public Task BookingDeletedAsync(Guid id) => Task.CompletedTask;
    public Task AvailabilityChangedAsync(Guid hotelId) => Task.CompletedTask;
}
