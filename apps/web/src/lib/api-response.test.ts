import { describe, expect, it } from 'vitest';
import {
  isCanvasMetaResponse,
  isCanvasSnapshotResponse,
  isPlacePixelResultResponse,
  isReplayMetaResponse,
} from './api-response';

describe('API response guards', () => {
  it('accepts valid canvas metadata and rejects invalid dimensions', () => {
    expect(isCanvasMetaResponse({ id: 'c1', term: 'F26', status: 'active', width: 10, height: 10, palette: 'default' })).toBe(true);
    expect(isCanvasMetaResponse({ id: 'c1', term: 'F26', status: 'active', width: 0, height: 10, palette: 'default' })).toBe(false);
  });

  it('rejects malformed and out-of-bounds snapshots', () => {
    expect(isCanvasSnapshotResponse({ width: 2, height: 2, seq: 1, cells: [{ x: 1, y: 1, color: 2 }] })).toBe(true);
    expect(isCanvasSnapshotResponse({ width: 2, height: 2, seq: 1, cells: [{ x: 2, y: 1, color: 2 }] })).toBe(false);
    expect(isCanvasSnapshotResponse({ width: 2, height: 2, seq: 1 })).toBe(false);
  });

  it('requires every authoritative placement field before settling a command', () => {
    expect(
      isPlacePixelResultResponse({
        at: { x: 1, y: 2 },
        color: 3,
        seq: 4,
        placedAt: '2026-06-29T00:00:00.000Z',
        cooldownMs: 300_000,
      }),
    ).toBe(true);
    expect(isPlacePixelResultResponse({ at: { x: 1, y: 2 }, color: 3, seq: 4 })).toBe(false);
  });

  it('rejects incomplete replay metadata', () => {
    expect(isReplayMetaResponse({ term: 'F26', eventCount: 2, fromSeq: 1, toSeq: 2, available: false })).toBe(true);
    expect(isReplayMetaResponse({ term: 'F26', eventCount: 2 })).toBe(false);
  });
});
