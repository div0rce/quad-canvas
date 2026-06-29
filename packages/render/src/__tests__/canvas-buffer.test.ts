import { describe, it, expect } from 'vitest';
import type { dto, ws, domain } from '@quad/core';
import { CanvasBuffer, EMPTY_CELL } from '../canvas-buffer.js';

function snapshot(
  width: number,
  height: number,
  seq: number,
  cells: Array<{ x: number; y: number; color: number }>,
): dto.CanvasSnapshotResponse {
  return {
    width,
    height,
    seq: seq as domain.PerCanvasSequence,
    cells: cells.map((c) => ({ x: c.x, y: c.y, color: c.color as domain.ColorIndex })),
  };
}

function placed(x: number, y: number, color: number, seq: number): ws.PixelPlaced {
  return {
    type: 'PixelPlaced',
    at: { x, y },
    color: color as domain.ColorIndex,
    seq: seq as domain.PerCanvasSequence,
  };
}

function rolledBack(x: number, y: number, seq: number, color?: number): ws.PixelRolledBack {
  return {
    type: 'PixelRolledBack',
    at: { x, y },
    seq: seq as domain.PerCanvasSequence,
    ...(color !== undefined ? { color: color as domain.ColorIndex } : {}),
  };
}

describe('CanvasBuffer', () => {
  it('starts empty', () => {
    const b = new CanvasBuffer(4, 4);
    expect(b.colorAt(0, 0)).toBe(EMPTY_CELL);
    expect(b.seq).toBe(0);
  });

  it('loads a snapshot, sets the watermark, and marks everything dirty', () => {
    const b = new CanvasBuffer(4, 4);
    b.loadSnapshot(snapshot(4, 4, 5, [{ x: 1, y: 1, color: 2 }]));
    expect(b.colorAt(1, 1)).toBe(2);
    expect(b.colorAt(0, 0)).toBe(EMPTY_CELL);
    expect(b.seq).toBe(5);
    expect(b.drainDirty()).toHaveLength(16);
  });

  it('applies a newer delta and reports only the changed cell as dirty', () => {
    const b = new CanvasBuffer(4, 4);
    b.loadSnapshot(snapshot(4, 4, 5, []));
    b.drainDirty();
    expect(b.applyDelta(placed(2, 3, 7, 6))).toBe(true);
    expect(b.colorAt(2, 3)).toBe(7);
    expect(b.seq).toBe(6);
    expect(b.drainDirty()).toEqual([{ x: 2, y: 3, color: 7 }]);
  });

  it('ignores stale deltas at or below the watermark (reorder/dup safe)', () => {
    const b = new CanvasBuffer(4, 4);
    b.loadSnapshot(snapshot(4, 4, 5, []));
    b.drainDirty();
    expect(b.applyDelta(placed(0, 0, 1, 5))).toBe(false);
    expect(b.applyDelta(placed(0, 0, 1, 3))).toBe(false);
    expect(b.colorAt(0, 0)).toBe(EMPTY_CELL);
    expect(b.seq).toBe(5);
    expect(b.drainDirty()).toHaveLength(0);
  });

  it('ignores out-of-bounds deltas', () => {
    const b = new CanvasBuffer(4, 4);
    expect(b.applyDelta(placed(4, 0, 1, 1))).toBe(false);
    expect(b.applyDelta(placed(-1, 0, 1, 1))).toBe(false);
  });

  it('rejects non-integer coordinates', () => {
    const b = new CanvasBuffer(4, 4);
    expect(b.applyDelta(placed(1.5, 1, 1, 1))).toBe(false);
    expect(b.colorAt(1, 1)).toBe(EMPTY_CELL);
  });

  it('signals a full repaint after a snapshot, then incremental drains', () => {
    const b = new CanvasBuffer(4, 4);
    b.loadSnapshot(snapshot(4, 4, 5, []));
    expect(b.needsFullRepaint()).toBe(true);
    expect(b.drainDirty()).toHaveLength(16);
    expect(b.needsFullRepaint()).toBe(false);
    b.applyDelta(placed(0, 0, 1, 6));
    expect(b.drainDirty()).toEqual([{ x: 0, y: 0, color: 1 }]);
  });

  it('rejects a sequence gap without advancing the watermark', () => {
    const b = new CanvasBuffer(4, 4);
    expect(b.applyDelta(placed(1, 1, 9, 2))).toBe(false);
    expect(b.colorAt(1, 1)).toBe(EMPTY_CELL);
    expect(b.seq).toBe(0);
    expect(b.applyDelta(placed(0, 0, 3, 1))).toBe(true);
    expect(b.applyDelta(placed(1, 1, 9, 2))).toBe(true);
  });

  it('applies a rollback: reverts to a prior color', () => {
    const b = new CanvasBuffer(4, 4);
    b.applyDelta(placed(1, 1, 7, 1));
    expect(b.applyRollback(rolledBack(1, 1, 2, 3))).toBe(true);
    expect(b.colorAt(1, 1)).toBe(3);
    expect(b.seq).toBe(2);
  });

  it('applies a rollback with no color: clears the cell', () => {
    const b = new CanvasBuffer(4, 4);
    b.applyDelta(placed(2, 2, 4, 1));
    expect(b.applyRollback(rolledBack(2, 2, 2))).toBe(true);
    expect(b.colorAt(2, 2)).toBe(EMPTY_CELL);
  });

  it('ignores a stale rollback (seq ≤ watermark)', () => {
    const b = new CanvasBuffer(4, 4);
    b.applyDelta(placed(0, 0, 1, 1));
    expect(b.applyRollback(rolledBack(0, 0, 1))).toBe(false);
    expect(b.colorAt(0, 0)).toBe(1);
  });
});
