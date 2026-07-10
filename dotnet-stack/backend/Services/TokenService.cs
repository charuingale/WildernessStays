using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using WildernessStays.Api.Models;

namespace WildernessStays.Api.Services;

public class TokenService(IConfiguration config)
{
    public static SymmetricSecurityKey Key(IConfiguration config) =>
        new(Encoding.UTF8.GetBytes(config["Jwt:Secret"] ?? "wilderness-dotnet-dev-secret-change-me-0123456789"));

    public string Sign(User user)
    {
        var token = new JwtSecurityToken(
            claims: new[]
            {
                new Claim("sub", user.Id.ToString()),
                new Claim("email", user.Email),
                new Claim("name", user.Name),
                new Claim("role", user.Role),
            },
            expires: DateTime.UtcNow.AddDays(7),
            signingCredentials: new SigningCredentials(Key(config), SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
