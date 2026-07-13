using System.ComponentModel.DataAnnotations;

namespace WildernessStays.Core.Contracts;

public record RegisterDto(
    [Required, MaxLength(120)] string Name,
    [Required, EmailAddress] string Email,
    [Required, MinLength(6, ErrorMessage = "Password must be at least 6 characters"), MaxLength(100)] string Password);

public record LoginDto(
    [Required, EmailAddress] string Email,
    [Required] string Password);

public class CreateBookingDto
{
    [Required] public Guid HotelId { get; set; }
    [Required] public Guid RoomId { get; set; }
    [Required, MaxLength(120)] public string GuestName { get; set; } = "";
    [Required, EmailAddress] public string Email { get; set; } = "";
    [MaxLength(30)] public string? Phone { get; set; }
    [Required] public DateOnly CheckIn { get; set; }
    [Required] public DateOnly CheckOut { get; set; }
    [Range(1, 20)] public int Guests { get; set; } = 1;
    [MaxLength(500)] public string? SpecialRequests { get; set; }
}

public class UpdateBookingDto
{
    [MaxLength(120)] public string? GuestName { get; set; }
    [EmailAddress] public string? Email { get; set; }
    [MaxLength(30)] public string? Phone { get; set; }
    public DateOnly? CheckIn { get; set; }
    public DateOnly? CheckOut { get; set; }
    [Range(1, 20)] public int? Guests { get; set; }
    [RegularExpression("confirmed|pending|cancelled")] public string? Status { get; set; }
    [MaxLength(500)] public string? SpecialRequests { get; set; }
}
