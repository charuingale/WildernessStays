using System.Collections.Concurrent;
using System.Text.Json;
using StackExchange.Redis;

namespace WildernessStays.Api.Services;

/// <summary>
/// Redis-backed cache with a transparent in-memory fallback, so the API
/// stays fully functional when Redis is unavailable (parity with the Node backend).
/// </summary>
public class CacheService
{
    private readonly ILogger<CacheService> _logger;
    private readonly ConnectionMultiplexer? _redis;
    private readonly ConcurrentDictionary<string, (string Value, DateTime ExpiresAt)> _memory = new();

    public CacheService(IConfiguration config, ILogger<CacheService> logger)
    {
        _logger = logger;
        try
        {
            var options = ConfigurationOptions.Parse(config["Redis"] ?? "localhost:6379");
            options.AbortOnConnectFail = false;
            options.ConnectTimeout = 1500;
            _redis = ConnectionMultiplexer.Connect(options);
            _logger.LogInformation("Redis configured — caching enabled (falls back to memory if unreachable)");
        }
        catch (Exception)
        {
            _logger.LogWarning("Redis unavailable — using in-memory cache");
        }
    }

    private bool RedisUp => _redis is { IsConnected: true };

    public async Task<T?> GetAsync<T>(string key)
    {
        if (RedisUp)
        {
            try
            {
                var raw = await _redis!.GetDatabase().StringGetAsync(key);
                return raw.HasValue ? JsonSerializer.Deserialize<T>(raw!) : default;
            }
            catch { /* fall through */ }
        }
        if (_memory.TryGetValue(key, out var hit) && hit.ExpiresAt > DateTime.UtcNow)
            return JsonSerializer.Deserialize<T>(hit.Value);
        _memory.TryRemove(key, out _);
        return default;
    }

    public async Task SetAsync(string key, object value, int ttlSeconds = 60)
    {
        var raw = JsonSerializer.Serialize(value);
        if (RedisUp)
        {
            try
            {
                await _redis!.GetDatabase().StringSetAsync(key, raw, TimeSpan.FromSeconds(ttlSeconds));
                return;
            }
            catch { /* fall through */ }
        }
        _memory[key] = (raw, DateTime.UtcNow.AddSeconds(ttlSeconds));
    }

    public async Task InvalidatePrefixAsync(string prefix)
    {
        if (RedisUp)
        {
            try
            {
                var endpoint = _redis!.GetEndPoints().First();
                var server = _redis.GetServer(endpoint);
                var db = _redis.GetDatabase();
                await foreach (var key in server.KeysAsync(pattern: $"{prefix}*"))
                    await db.KeyDeleteAsync(key);
            }
            catch { /* fall through */ }
        }
        foreach (var key in _memory.Keys.Where(k => k.StartsWith(prefix)))
            _memory.TryRemove(key, out _);
    }
}
