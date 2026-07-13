using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WildernessStays.Core.Contracts;
using WildernessStays.Core.Services;

namespace WildernessStays.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(AuthService auth) : ControllerBase
{
    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterDto dto) =>
        StatusCode(201, await auth.RegisterAsync(dto.Name, dto.Email, dto.Password));

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginDto dto) =>
        StatusCode(201, await auth.LoginAsync(dto.Email, dto.Password));

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
