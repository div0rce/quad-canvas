import { describe, it, expect } from 'vitest';
import { InMemoryRateCounter, RedisRateCounter } from './rate-counter.js';

describe('InMemoryRateCounter', () => {
  it('counts placements within the window and reads them back per canvas', async () => {
    const rc = new InMemoryRateCounter(60, () => 1000);
    expect(await rc.recent('c1')).toBe(0);
    await rc.record('c1');
    await rc.record('c1');
    await rc.record('c2');
    expect(await rc.recent('c1')).toBe(2);
    expect(await rc.recent('c2')).toBe(1);
  });

  it('decays gradually across window boundaries (no abrupt reset)', async () => {
    let now = 0;
    const rc = new InMemoryRateCounter(60, () => now);
    await rc.record('c1');
    await rc.record('c1');
    expect(await rc.recent('c1')).toBe(2); // full count in the current window
    now = 90_000; // 1.5 windows later: the previous window (2) is half-decayed
    expect(await rc.recent('c1')).toBe(1); // 2 * (1 - 0.5)
    now = 120_000; // two windows later: the previous window has fully aged out
    expect(await rc.recent('c1')).toBe(0);
  });
});

describe('RedisRateCounter', () => {
  // Minimal fake: `eval` simulates the atomic INCR(+EXPIRE), capturing the per-key TTL arg; `get`
  // reads the bucket back. Lets us assert both the boundary decay AND the two-window expiry.
  function fakeRedis() {
    const store = new Map<string, number>();
    const ttls = new Map<string, number>();
    return {
      store,
      ttls,
      get: async (key: string): Promise<string | null> => {
        const v = store.get(key);
        return v === undefined ? null : String(v);
      },
      eval: async (_script: string, _numKeys: number, key: string, ttl: string): Promise<number> => {
        store.set(key, (store.get(key) ?? 0) + 1);
        ttls.set(key, Number(ttl)); // EXPIRE is set on every write (atomic with INCR in the real script)
        return 1;
      },
    };
  }

  it('decays gradually across window boundaries (sliding window over per-index Redis keys)', async () => {
    let now = 0;
    const redis = fakeRedis();
    const rc = new RedisRateCounter(redis as never, 60, () => now);
    await rc.record('c1');
    await rc.record('c1');
    expect(await rc.recent('c1')).toBe(2); // both in the current window
    // Two-window expiry: each bucket is kept for 2 × the window so it can serve as the next "previous".
    expect([...redis.ttls.values()].every((t) => t === 120)).toBe(true);
    now = 90_000; // 1.5 windows: previous (2) half-decayed
    expect(await rc.recent('c1')).toBe(1);
    now = 120_000; // two windows: previous fully aged out
    expect(await rc.recent('c1')).toBe(0);
  });
});
