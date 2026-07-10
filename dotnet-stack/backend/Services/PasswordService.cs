using System.Security.Cryptography;

namespace WildernessStays.Api.Services;

/// <summary>PBKDF2-SHA256 password hashing via built-in crypto (no extra packages).</summary>
public static class PasswordService
{
    private const int Iterations = 100_000;
    private const int SaltSize = 16;
    private const int HashSize = 32;

    public static string Hash(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(SaltSize);
        var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, HashAlgorithmName.SHA256, HashSize);
        return $"{Convert.ToHexString(salt)}:{Convert.ToHexString(hash)}";
    }

    public static bool Verify(string password, string stored)
    {
        var parts = stored.Split(':');
        if (parts.Length != 2) return false;
        var salt = Convert.FromHexString(parts[0]);
        var expected = Convert.FromHexString(parts[1]);
        var actual = Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, HashAlgorithmName.SHA256, expected.Length);
        return CryptographicOperations.FixedTimeEquals(actual, expected);
    }
}
