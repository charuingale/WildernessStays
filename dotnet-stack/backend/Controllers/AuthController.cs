using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WildernessStays.Api.Data;
using WildernessStays.Api.Dtos;
using WildernessStays.Api.Models;
using WildernessStays.Api.Services;

namespace WildernessStays.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(AppDbContext db, TokenService tokens) : ControllerBase
{
    private static object PublicUser(User u) => new { id = u.Id, name = u.Name, email = u.Email, role = u.Role };

    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterDto dto)
    {
        var email = dto.Email.ToLowerInvariant();
        if (await db.Users.AnyAsync(u => u.Email == email))
            return Conflict(new { message = "An account with this email already exists" });

        var user = new User { Name = dto.Name.Trim(), Email = email, PasswordHash = PasswordService.Hash(dto.Password) };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return StatusCode(201, new { token = tokens.Sign(user), user = PublicUser(user) });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginDto dto)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == dto.Email.ToLowerInvariant());
        if (user is null || !PasswordService.Verify(dto.Password, user.PasswordHash))
            return Unauthorized(new { message = "Incorrect email or password" });
        return StatusCode(201, new { token = tokens.Sign(user), user = PublicUser(user) });
    }

    [HttpGet("me")]
    [Authorize]
    public IActionResult Me() => Ok(new
    {
        id = User.FindFirst("sub")?.Value,
        name = User.FindFirst("name")?.Value,
        email = User.FindFirst("email")?.Value,
        role = User.FindFirst("role")?.Value,
    });
}
