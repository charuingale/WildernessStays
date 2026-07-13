using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using WildernessStays.Core.Data;
using WildernessStays.Core.Events;
using WildernessStays.Core.Services;

namespace WildernessStays.Core;

public static class DependencyInjection
{
    /// <summary>
    /// Registers the Wilderness Stays data layer and business services.
    /// The host may register its own <see cref="IBookingEvents"/> implementation
    /// (e.g. SignalR) before or after calling this; otherwise events are no-ops.
    /// </summary>
    public static IServiceCollection AddWildernessStaysCore(
        this IServiceCollection services, string connectionString, WildernessOptions? options = null)
    {
        services.AddSingleton(options ?? new WildernessOptions());
        services.AddDbContext<AppDbContext>(o => o.UseNpgsql(connectionString));
        services.AddSingleton<CacheService>();
        services.AddSingleton<TokenService>();
        services.AddScoped<PaymentsService>();
        services.AddScoped<AuthService>();
        services.AddScoped<HotelService>();
        services.AddScoped<BookingService>();
        services.TryAddSingleton<IBookingEvents, NullBookingEvents>();
        return services;
    }
}
