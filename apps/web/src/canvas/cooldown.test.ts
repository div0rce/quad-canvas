import { describe, it, expect } from 'vitest';
import { formatCountdown, remainingMs } from './cooldown';

describe('remainingMs', () => {
  it('floors at zero', () => {
    expect(remainingMs(1000, 600)).toBe(400);
    expect(remainingMs(500, 1000)).toBe(0);
  });
});

describe('formatCountdown', () => {
  it('is empty when done', () => {
    expect(formatCountdown(0)).toBe('');
    expect(formatCountdown(-100)).toBe('');
  });

  it('rounds up to whole seconds under a minute', () => {
    expect(formatCountdown(5000)).toBe('5s');
    expect(formatCountdown(4001)).toBe('5s');
    expect(formatCountdown(1)).toBe('1s');
  });

  it('formats minutes:seconds at/over a minute', () => {
    expect(formatCountdown(60_000)).toBe('1:00');
    expect(formatCountdown(65_000)).toBe('1:05');
    expect(formatCountdown(125_000)).toBe('2:05');
  });
});
