import { describe, it, expect } from 'vitest';
import { InMemorySessionStore, newSessionId } from './session-store.js';

describe('InMemorySessionStore', () => {
  it('creates an opaque id, resolves it, and revokes it', async () => {
    const store = new InMemorySessionStore();
    const id = await store.create({ userId: 'u1', tenantId: 't1' }, 3600);
    expect(id).toMatch(/^[0-9a-f]{64}$/); // 256 bits of entropy, hex
    expect(await store.get(id)).toEqual({ userId: 'u1', tenantId: 't1' });
    await store.revoke(id);
    expect(await store.get(id)).toBeNull();
  });

  it('expires sessions after the TTL', async () => {
    let now = 1000;
    const store = new InMemorySessionStore(() => now);
    const id = await store.create({ userId: 'u1', tenantId: 't1' }, 10);
    expect(await store.get(id)).not.toBeNull();
    now += 11_000;
    expect(await store.get(id)).toBeNull();
  });

  it('returns null for an unknown session', async () => {
    const store = new InMemorySessionStore();
    expect(await store.get(newSessionId())).toBeNull();
  });

  it('rejects an invalid TTL (consistent with the Redis backend)', () => {
    const store = new InMemorySessionStore();
    expect(() => store.create({ userId: 'u', tenantId: 't' }, 0)).toThrow(RangeError);
    expect(() => store.create({ userId: 'u', tenantId: 't' }, -5)).toThrow();
    expect(() => store.create({ userId: 'u', tenantId: 't' }, 1.5)).toThrow();
  });
});
