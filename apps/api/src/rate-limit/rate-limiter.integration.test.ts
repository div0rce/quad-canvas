import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import { Redis } from 'ioredis';
import { RedisRateLimiter } from './rate-limiter.js';

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://127.0.0.1:6379';
const redis = new Redis(REDIS_URL);
const KEY = 'rl-it-key';

afterAll(async () => {
  await redis.quit();
});

beforeEach(async () => {
  await redis.del(`ratelimit:${KEY}`);
});

describe('RedisRateLimiter', () => {
  it('allows up to the limit then blocks within the window', async () => {
    const rl = new RedisRateLimiter(redis);
    expect((await rl.hit(KEY, 2, 60)).allowed).toBe(true);
    expect((await rl.hit(KEY, 2, 60)).allowed).toBe(true);
    const third = await rl.hit(KEY, 2, 60);
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
    expect(third.resetSec).toBeGreaterThan(0);
  });

  it('sets a TTL on the first hit so the window expires', async () => {
    const rl = new RedisRateLimiter(redis);
    await rl.hit(KEY, 5, 60);
    const ttl = await redis.ttl(`ratelimit:${KEY}`);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(60);
  });
});
