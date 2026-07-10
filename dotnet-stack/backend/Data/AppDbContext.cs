using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using WildernessStays.Api.Models;

namespace WildernessStays.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Hotel> Hotels => Set<Hotel>();
    public DbSet<Room> Rooms => Set<Room>();
    public DbSet<Booking> Bookings => Set<Booking>();
    public DbSet<User> Users => Set<User>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var jsonOpts = new JsonSerializerOptions(JsonSerializerDefaults.Web);

        // Comma-separated string lists (parity with TypeORM's simple-array)
        var listComparer = new ValueComparer<List<string>>(
            (a, b) => (a ?? new List<string>()).SequenceEqual(b ?? new List<string>()),
            v => v.Aggregate(0, (h, s) => HashCode.Combine(h, s.GetHashCode())),
            v => v.ToList());

        void StringList<T>(ModelBuilder mb, string property) where T : class
        {
            mb.Entity<T>()
              .Property<List<string>>(property)
              .HasConversion(
                  v => string.Join(",", v),
                  v => v.Length == 0 ? new List<string>() : v.Split(',', StringSplitOptions.None).ToList())
              .Metadata.SetValueComparer(listComparer);
        }

        modelBuilder.Entity<Hotel>(e =>
        {
            e.ToTable("hotels");
            e.Property(h => h.PricePerNight).HasPrecision(10, 2);
            e.Property(h => h.Rating).HasPrecision(2, 1);
            e.Property(h => h.NearbyPlaces)
             .HasColumnType("jsonb")
             .HasConversion(
                 v => JsonSerializer.Serialize(v, jsonOpts),
                 v => JsonSerializer.Deserialize<List<NearbyPlace>>(v, jsonOpts) ?? new List<NearbyPlace>(),
                 new ValueComparer<List<NearbyPlace>>(
                     (a, b) => JsonSerializer.Serialize(a, jsonOpts) == JsonSerializer.Serialize(b, jsonOpts),
                     v => JsonSerializer.Serialize(v, jsonOpts).GetHashCode(),
                     v => JsonSerializer.Deserialize<List<NearbyPlace>>(JsonSerializer.Serialize(v, jsonOpts), jsonOpts)!));
            e.HasMany(h => h.Rooms).WithOne(r => r.Hotel).HasForeignKey(r => r.HotelId).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(h => h.Bookings).WithOne(b => b.Hotel).HasForeignKey(b => b.HotelId).OnDelete(DeleteBehavior.Cascade);
        });
        StringList<Hotel>(modelBuilder, nameof(Hotel.Amenities));
        StringList<Hotel>(modelBuilder, nameof(Hotel.Images));

        modelBuilder.Entity<Room>(e =>
        {
            e.ToTable("rooms");
            e.Property(r => r.PricePerNight).HasPrecision(10, 2);
        });
        StringList<Room>(modelBuilder, nameof(Room.Amenities));
        StringList<Room>(modelBuilder, nameof(Room.Images));

        modelBuilder.Entity<Booking>(e =>
        {
            e.ToTable("bookings");
            e.Property(b => b.TotalPrice).HasPrecision(10, 2);
            e.HasOne(b => b.Room).WithMany().HasForeignKey(b => b.RoomId).OnDelete(DeleteBehavior.SetNull);
            e.HasIndex(b => new { b.RoomId, b.CheckIn, b.CheckOut });
        });

        modelBuilder.Entity<User>(e =>
        {
            e.ToTable("users");
            e.HasIndex(u => u.Email).IsUnique();
        });
    }
}
