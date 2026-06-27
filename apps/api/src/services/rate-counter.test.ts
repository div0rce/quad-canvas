import { describe, it, expect } from 'vitest';
import { InMemoryRateCounter } from './rate-counter.js';

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

  it('resets after the window elapses', async () => {
    let now = 0;
    const rc = new InMemoryRateCounter(60, () => now);
    await rc.record('c1');
    await rc.record('c1');
    expect(await rc.recent('c1')).toBe(2);
    now += 60_000; // window elapsed
    expect(await rc.recent('c1')).toBe(0);
  });
});
