import { describe, expect, it } from 'vitest';
import type { dto } from '@quad/core';
import { boardSize, statsSummary, welcomeName } from './home-client';

describe('welcomeName', () => {
  it('prefers the display name, falls back to the handle, then a neutral word', () => {
    expect(welcomeName('@mira7', 'Mira')).toBe('Mira');
    expect(welcomeName('mira7')).toBe('mira7');
    expect(welcomeName('@mira7', '   ')).toBe('mira7'); // a blank display name is ignored
    expect(welcomeName('')).toBe('placer');
  });
});

describe('statsSummary', () => {
  it('formats placed + surviving with thousands separators', () => {
    const profile = { pixelsPlaced: 1482, lifetimeStats: { survivingPixels: 612 } } as unknown as dto.ProfileResponse;
    expect(statsSummary(profile)).toBe('1,482 placed · 612 surviving');
    expect(statsSummary(null)).toBe('—');
  });
});

describe('boardSize', () => {
  it('formats the board dimensions or null', () => {
    expect(boardSize({ width: 40, height: 30 } as unknown as dto.CanvasMetaResponse)).toBe('40 × 30');
    expect(boardSize(null)).toBeNull();
  });
});
