import { describe, it, expect } from 'vitest';
import { loadScore, dynamicCooldownMs, type CooldownConfig } from './cooldown.js';

const config: CooldownConfig = { minMs: 5 * 60_000, maxMs: 20 * 60_000, saturationRatePerMin: 100 };

describe('loadScore', () => {
  it('is 0 when idle and 1 at/above saturation', () => {
    expect(loadScore(0, 100)).toBe(0);
    expect(loadScore(50, 100)).toBe(0.5);
    expect(loadScore(100, 100)).toBe(1);
    expect(loadScore(200, 100)).toBe(1); // clamped
  });

  it('is 0 for non-positive inputs', () => {
    expect(loadScore(-5, 100)).toBe(0);
    expect(loadScore(50, 0)).toBe(0);
  });
});

describe('dynamicCooldownMs', () => {
  it('is the floor when idle and the ceiling at saturation', () => {
    expect(dynamicCooldownMs(0, config)).toBe(config.minMs);
    expect(dynamicCooldownMs(100, config)).toBe(config.maxMs);
    expect(dynamicCooldownMs(1000, config)).toBe(config.maxMs); // clamped
  });

  it('scales linearly between floor and ceiling with load', () => {
    expect(dynamicCooldownMs(50, config)).toBe((config.minMs + config.maxMs) / 2);
    expect(dynamicCooldownMs(25, config)).toBe(config.minMs + (config.maxMs - config.minMs) * 0.25);
  });

  it('grows monotonically with the placement rate', () => {
    const a = dynamicCooldownMs(10, config);
    const b = dynamicCooldownMs(40, config);
    const c = dynamicCooldownMs(80, config);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
  });
});
