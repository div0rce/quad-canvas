import { describe, it, expect } from 'vitest';
import { InMemoryRateLimiter } from './rate-limiter.js';

describe('InMemoryRateLimiter', () => {
  it('allows up to the limit then blocks within the window', async () => {
    const rl = new InMemoryRateLimiter(() => 1000);
    expect((await rl.hit('k', 2, 60)).allowed).toBe(true);
    expect((await rl.hit('k', 2, 60)).allowed).toBe(true);
    const third = await rl.hit('k', 2, 60);
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
    expect(third.resetSec).toBeGreaterThan(0);
  });

  it('resets after the window elapses', async () => {
    let now = 0;
    const rl = new InMemoryRateLimiter(() => now);
    expect((await rl.hit('k', 1, 60)).allowed).toBe(true); // count 1
    expect((await rl.hit('k', 1, 60)).allowed).toBe(false); // count 2 > 1
    now += 60_000; // window elapsed
    expect((await rl.hit('k', 1, 60)).allowed).toBe(true); // fresh window
  });

  it('tracks keys independently', async () => {
    const rl = new InMemoryRateLimiter(() => 0);
    expect((await rl.hit('a', 1, 60)).allowed).toBe(true);
    expect((await rl.hit('b', 1, 60)).allowed).toBe(true); // different key, own budget
  });
});
