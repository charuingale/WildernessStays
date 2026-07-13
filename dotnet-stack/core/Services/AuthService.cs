using Microsoft.EntityFrameworkCore;
using WildernessStays.Core.Contracts;
using WildernessStays.Core.Data;
using WildernessStays.Core.Models;

namespace WildernessStays.Core.Services;

public class AuthService(AppDbContext db, TokenService tokens)
{
    private static AuthUser Public(User u) => new(u.Id, u.Name, u.Email, u.Role);

    public async Task<AuthResult> RegisterAsync(string name, string email, string password)
    {
        var normalized = email.ToLowerInvariant();
        if (await db.Users.AnyAsync(u => u.Email == normalized))
            throw new ConflictException("An account with this email already exists");

        var user = new User { Name = name.Trim(), Email = normalized, PasswordHash = PasswordService.Hash(password) };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return new AuthResult(tokens.Sign(user), Public(user));
    }

    public async Task<AuthResult> LoginAsync(string email, string password)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email.ToLowerInvariant());
        if (user is null || !PasswordService.Verify(password, user.PasswordHash))
            throw new UnauthorizedException("Incorrect email or password");
        return new AuthResult(tokens.Sign(user), Public(user));
    }
}
