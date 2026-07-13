using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using WildernessStays.Core.Models;

namespace WildernessStays.Core.Services;

public class TokenService(WildernessOptions options)
{
    public static SymmetricSecurityKey Key(string secret) => new(Encoding.UTF8.GetBytes(secret));

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
            signingCredentials: new SigningCredentials(Key(options.JwtSecret), SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
