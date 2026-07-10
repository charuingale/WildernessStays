import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Redis-backed cache with a transparent in-memory fallback so the app
 * remains fully functional when Redis is unavailable (e.g. local dev).
 */
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private redis: Redis | null = null;
  private redisHealthy = false;
  private memory = new Map<string, { value: string; expiresAt: number }>();

  constructor() {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    try {
      this.redis = new Redis(url, {
        lazyConnect: false,
        maxRetriesPerRequest: 1,
        retryStrategy: (times) => (times > 3 ? null : Math.min(times * 500, 2000)),
      });
      this.redis.on('ready', () => {
        this.redisHealthy = true;
        this.logger.log('Redis connected — caching enabled');
      });
      this.redis.on('error', () => {
        if (this.redisHealthy) this.logger.warn('Redis connection lost — using in-memory cache');
        this.redisHealthy = false;
      });
    } catch {
      this.logger.warn('Redis unavailable — using in-memory cache');
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.redisHealthy && this.redis) {
      try {
        const raw = await this.redis.get(key);
        return raw ? (JSON.parse(raw) as T) : null;
      } catch { /* fall through */ }
    }
    const hit = this.memory.get(key);
    if (hit && hit.expiresAt > Date.now()) return JSON.parse(hit.value) as T;
    this.memory.delete(key);
    return null;
  }

  async set(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
    const raw = JSON.stringify(value);
    if (this.redisHealthy && this.redis) {
      try {
        await this.redis.set(key, raw, 'EX', ttlSeconds);
        return;
      } catch { /* fall through */ }
    }
    this.memory.set(key, { value: raw, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async invalidatePrefix(prefix: string): Promise<void> {
    if (this.redisHealthy && this.redis) {
      try {
        const keys = await this.redis.keys(`${prefix}*`);
        if (keys.length) await this.redis.del(...keys);
      } catch { /* fall through */ }
    }
    for (const key of this.memory.keys()) {
      if (key.startsWith(prefix)) this.memory.delete(key);
    }
  }

  onModuleDestroy() {
    this.redis?.disconnect();
  }
}
