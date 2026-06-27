import { describe, it, expect } from 'vitest';
import { colorHex, colorName } from './inspector-client';

describe('colorHex', () => {
  it('resolves known palette colors', () => {
    expect(colorHex('default', 0)).toBe('#FFFFFF'); // White
    expect(colorHex('default', 2)).toBe('#CC0033'); // Red
  });

  it('falls back for an unknown index or palette', () => {
    expect(colorHex('default', 999)).toBe('#cccccc');
    expect(colorHex('no-such-palette', 0)).toBe('#cccccc');
  });
});

describe('colorName', () => {
  it('resolves known palette color names', () => {
    expect(colorName('default', 0)).toBe('White');
    expect(colorName('default', 2)).toBe('Red');
  });

  it('falls back to a generic label for an unknown index/palette', () => {
    expect(colorName('default', 999)).toBe('color 999');
    expect(colorName('no-such-palette', 1)).toBe('color 1');
  });
});
