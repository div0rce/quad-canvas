import { describe, it, expect } from 'vitest';
import { ordinal, heatLevel } from './content-client';

describe('heatLevel', () => {
  it('buckets a day count 0–4 relative to the busiest day', () => {
    expect(heatLevel(0, 10)).toBe(0);
    expect(heatLevel(1, 10)).toBe(1);
    expect(heatLevel(5, 10)).toBe(2);
    expect(heatLevel(10, 10)).toBe(4);
  });

  it('guards empty input', () => {
    expect(heatLevel(3, 0)).toBe(0);
    expect(heatLevel(-1, 10)).toBe(0);
  });
});

describe('ordinal', () => {
  it('formats 1st/2nd/3rd/4th', () => {
    expect(ordinal(1)).toBe('1st');
    expect(ordinal(2)).toBe('2nd');
    expect(ordinal(3)).toBe('3rd');
    expect(ordinal(4)).toBe('4th');
  });

  it('handles the 11–13 teens and the 21/22/23 wrap', () => {
    expect(ordinal(11)).toBe('11th');
    expect(ordinal(12)).toBe('12th');
    expect(ordinal(13)).toBe('13th');
    expect(ordinal(21)).toBe('21st');
    expect(ordinal(22)).toBe('22nd');
    expect(ordinal(113)).toBe('113th');
  });
});
