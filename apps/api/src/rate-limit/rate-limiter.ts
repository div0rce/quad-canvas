// apps/api — abuse-protection rate limiting. This is DISTINCT from the placement cooldown: cooldown
// is per-user placement fairness (COOLDOWN_ACTIVE) enforced in the write transaction; this is coarse
// request-rate abuse protection (RATE_LIMITED) at the HTTP boundary. Fixed-window counters.
import type { Redis } from 'ioredis';

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly remaining: number;
  /** Seconds until the current window resets (for Retry-After). */
  readonly resetSec: number;
}

export interface RateLimiter {
  /** Count one request against `key`; allowed while the window count is ≤ `limit`. */
  hit(key: string, limit: number, windowSec: number): Promise<RateLimitResult>;
}

/** Single-node fixed-window limiter. Clock injected for deterministic tests. */
export class InMemoryRateLimiter implements RateLimiter {
  readonly #buckets = new Map<string, { count: number; resetAt: number }>();
  readonly #now: () => number;
  readonly #sweepIntervalMs: number;
  #lastSweep = 0;

  constructor(now: () => number = () => Date.now(), sweepIntervalMs = 60_000) {
    this.#now = now;
    this.#sweepIntervalMs = sweepIntervalMs;
  }

  // Drop expired buckets at most once per interval so high-cardinality subjects (e.g. many anonymous
  // IPs) can't grow the map without bound — this is the default backend when Redis is absent.
  #sweep(now: number): void {
    if (now - this.#lastSweep < this.#sweepIntervalMs) return;
    this.#lastSweep = now;
    for (const [key, bucket] of this.#buckets) {
      if (now >= bucket.resetAt) this.#buckets.delete(key);
    }
  }

  async hit(key: string, limit: number, windowSec: number): Promise<RateLimitResult> {
    const now = this.#now();
    this.#sweep(now);
    let bucket = this.#buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowSec * 1000 };
      this.#buckets.set(key, bucket);
    }
    bucket.count += 1;
    return {
      allowed: bucket.count <= limit,
      remaining: Math.max(0, limit - bucket.count),
      resetSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
}

/** Cross-node fixed-window limiter backed by Redis (INCR + EXPIRE). */
export class RedisRateLimiter implements RateLimiter {
  readonly #redis: Redis;

  constructor(redis: Redis) {
    this.#redis = redis;
  }

  async hit(key: string, limit: number, windowSec: number): Promise<RateLimitResult> {
    const k = `ratelimit:${key}`;
    const count = await this.#redis.incr(k);
    if (count === 1) {
      // First hit in the window — start the TTL.
      await this.#redis.expire(k, windowSec);
    }
    let ttl = await this.#redis.ttl(k);
    if (ttl < 0) {
      // No TTL (e.g. a key that predated EXPIRE) — set one so the window can never get stuck open.
      await this.#redis.expire(k, windowSec);
      ttl = windowSec;
    }
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetSec: Math.max(1, ttl),
    };
  }
}
