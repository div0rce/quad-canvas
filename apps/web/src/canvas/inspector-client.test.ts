import { afterEach, describe, it, expect, vi } from 'vitest';
import { colorHex, colorName, fetchPixelHistory } from './inspector-client';

afterEach(() => vi.unstubAllGlobals());

describe('fetchPixelHistory', () => {
  it('loads history beyond the first 200-entry page', async () => {
    vi.stubGlobal('fetch', async (url: string) => {
      const second = url.includes('cursor=200');
      return Response.json({
        data: [{ color: second ? 2 : 1, seq: second ? 201 : 1, placedAt: '2026-01-01T00:00:00.000Z' }],
        page: { nextCursor: second ? null : '200', limit: 200 },
      });
    });

    const result = await fetchPixelHistory(1, 2);
    expect(result?.data.map((entry) => entry.seq)).toEqual([1, 201]);
  });
});

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
