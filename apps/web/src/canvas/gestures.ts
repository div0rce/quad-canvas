// apps/web — pure pan-clamp for the canvas viewport. The canvas fills the container at scale 1; this
// keeps the pan offset within bounds so the (scaled) canvas always covers the container and can't be
// dragged off into empty space. At scale 1 the offset is pinned to 0 (nothing to pan). The zoom math
// (zoomAt/clampScale) lives in @quad/render.

import { clampScale } from '@quad/render';

/** Next zoom scale for a pinch: current scale × the finger-distance ratio, clamped. The caller then
 *  re-anchors the viewport around the pinch midpoint (zoomAt). */
export function pinchScale(currentScale: number, dist: number, prevDist: number, minScale: number, maxScale: number): number {
  const ratio = prevDist > 0 ? dist / prevDist : 1;
  return clampScale(currentScale * ratio, minScale, maxScale);
}

export function clampPan(
  scale: number,
  offsetX: number,
  offsetY: number,
  width: number,
  height: number,
): { offsetX: number; offsetY: number } {
  const minX = Math.min(0, width - width * scale); // most-negative offset that still covers the right edge
  const minY = Math.min(0, height - height * scale);
  return {
    offsetX: Math.min(0, Math.max(minX, offsetX)),
    offsetY: Math.min(0, Math.max(minY, offsetY)),
  };
}
