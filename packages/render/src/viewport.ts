// @quad/render — pan/zoom coordinate math. The view layer owns the actual <canvas> transform; this
// keeps the screen↔cell mapping pure and unit-testable. `scale` is screen pixels per cell; `offset`
// is the screen position of cell (0,0).
export interface Viewport {
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Screen pixel → canvas cell (floored to the containing cell). */
export function screenToCell(viewport: Viewport, screenX: number, screenY: number): Point {
  return {
    x: Math.floor((screenX - viewport.offsetX) / viewport.scale),
    y: Math.floor((screenY - viewport.offsetY) / viewport.scale),
  };
}

/** Canvas cell → screen pixel (top-left corner of the cell). */
export function cellToScreen(viewport: Viewport, cellX: number, cellY: number): Point {
  return {
    x: cellX * viewport.scale + viewport.offsetX,
    y: cellY * viewport.scale + viewport.offsetY,
  };
}

/** Clamp a zoom scale to [min, max]. */
export function clampScale(scale: number, min: number, max: number): number {
  return Math.min(Math.max(scale, min), max);
}

/**
 * Zoom around a fixed screen anchor (e.g. the cursor): the cell under the anchor stays under it.
 * Returns the new viewport with the recomputed offset.
 */
export function zoomAt(viewport: Viewport, anchorX: number, anchorY: number, nextScale: number): Viewport {
  const cellX = (anchorX - viewport.offsetX) / viewport.scale;
  const cellY = (anchorY - viewport.offsetY) / viewport.scale;
  return {
    scale: nextScale,
    offsetX: anchorX - cellX * nextScale,
    offsetY: anchorY - cellY * nextScale,
  };
}
