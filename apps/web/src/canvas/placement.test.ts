import { describe, it, expect } from 'vitest';
import { cellFromPoint, placementStatusMessage } from './placement';

const rect = { left: 0, top: 0, width: 100, height: 100 };

describe('cellFromPoint', () => {
  it('maps a point to the right cell on a 10x10 grid', () => {
    expect(cellFromPoint(rect, 5, 5, 10, 10)).toEqual({ x: 0, y: 0 });
    expect(cellFromPoint(rect, 95, 95, 10, 10)).toEqual({ x: 9, y: 9 });
    expect(cellFromPoint(rect, 55, 25, 10, 10)).toEqual({ x: 5, y: 2 });
  });

  it('honors the rect offset (canvas not at origin)', () => {
    expect(cellFromPoint({ left: 50, top: 20, width: 100, height: 100 }, 55, 25, 10, 10)).toEqual({ x: 0, y: 0 });
  });

  it('returns null outside the grid or for a zero-size rect', () => {
    expect(cellFromPoint(rect, -1, 5, 10, 10)).toBeNull();
    expect(cellFromPoint(rect, 5, 101, 10, 10)).toBeNull();
    expect(cellFromPoint({ left: 0, top: 0, width: 0, height: 100 }, 5, 5, 10, 10)).toBeNull();
  });
});

describe('placementStatusMessage', () => {
  it('maps success and auth/permission states', () => {
    expect(placementStatusMessage(201)).toMatch(/placed/i);
    expect(placementStatusMessage(401)).toMatch(/sign in/i);
    expect(placementStatusMessage(403)).toMatch(/not allowed/i);
    expect(placementStatusMessage(404)).toMatch(/no active canvas/i);
  });

  it('distinguishes cooldown from rate limiting on 429', () => {
    expect(placementStatusMessage(429, 'COOLDOWN_ACTIVE')).toMatch(/cooldown/i);
    expect(placementStatusMessage(429, 'RATE_LIMITED')).toMatch(/slow down|too many/i);
  });

  it('falls back to the server message then a generic message', () => {
    expect(placementStatusMessage(422, undefined, 'Color is not in the tenant palette.')).toMatch(/palette/);
    expect(placementStatusMessage(500)).toMatch(/could not place/i);
  });
});
