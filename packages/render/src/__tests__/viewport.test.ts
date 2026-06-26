import { describe, it, expect } from 'vitest';
import { screenToCell, cellToScreen, clampScale, zoomAt, type Viewport } from '../viewport.js';

describe('viewport math', () => {
  const vp: Viewport = { scale: 10, offsetX: 5, offsetY: 5 };

  it('maps cell → screen and screen → cell consistently', () => {
    expect(cellToScreen(vp, 2, 3)).toEqual({ x: 25, y: 35 });
    // any screen point within a cell maps back to that cell
    expect(screenToCell(vp, 25, 35)).toEqual({ x: 2, y: 3 });
    expect(screenToCell(vp, 34, 44)).toEqual({ x: 2, y: 3 });
  });

  it('clamps scale to bounds', () => {
    expect(clampScale(0.1, 1, 40)).toBe(1);
    expect(clampScale(100, 1, 40)).toBe(40);
    expect(clampScale(12, 1, 40)).toBe(12);
  });

  it('keeps the anchored cell fixed when zooming', () => {
    const anchorX = 105;
    const anchorY = 5;
    const before = screenToCell(vp, anchorX, anchorY);
    const zoomed = zoomAt(vp, anchorX, anchorY, 20);
    const after = screenToCell(zoomed, anchorX, anchorY);
    expect(after).toEqual(before);
  });
});
