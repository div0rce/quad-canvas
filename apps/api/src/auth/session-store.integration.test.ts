import { afterAll, describe, it, expect } from 'vitest';
import { Redis } from 'ioredis';
import { RedisSessionStore } from './session-store.js';

// Requires the local Docker Compose Redis (see vitest.integration.config.ts).
const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://127.0.0.1:6379';
const redis = new Redis(REDIS_URL);
const store = new RedisSessionStore(redis);

afterAll(async () => {
  await redis.quit();
});

describe('RedisSessionStore', () => {
  it('creates, resolves, and revokes a session', async () => {
    const id = await store.create({ userId: 'u1', tenantId: 't1' }, 60);
    expect(await store.get(id)).toEqual({ userId: 'u1', tenantId: 't1' });
    await store.revoke(id); // immediate revocation (AUTH-INV-8)
    expect(await store.get(id)).toBeNull();
  });

  it('honors the TTL', async () => {
    const id = await store.create({ userId: 'u2', tenantId: 't1' }, 1);
    expect(await store.get(id)).not.toBeNull();
    await new Promise((r) => setTimeout(r, 1200));
    expect(await store.get(id)).toBeNull();
  });
});
