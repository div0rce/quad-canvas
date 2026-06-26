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

  it('revokes all of a user’s sessions at once (ban — AUTH-INV-8)', async () => {
    const a = await store.create({ userId: 'banme', tenantId: 't1' }, 60);
    const b = await store.create({ userId: 'banme', tenantId: 't1' }, 60);
    expect(await store.get(a)).not.toBeNull();
    await store.revokeAllForUser('banme');
    expect(await store.get(a)).toBeNull();
    expect(await store.get(b)).toBeNull();
  });

  it('keeps the user index alive for the longest-lived session (index TTL never shrinks)', async () => {
    const long = await store.create({ userId: 'mixed', tenantId: 't1' }, 60);
    await store.create({ userId: 'mixed', tenantId: 't1' }, 1); // a shorter session must NOT shrink the index
    await new Promise((r) => setTimeout(r, 1300)); // the short session expires; the index must survive
    expect(await store.get(long)).not.toBeNull();
    await store.revokeAllForUser('mixed'); // index still present → the long session is revoked
    expect(await store.get(long)).toBeNull();
  });
});
