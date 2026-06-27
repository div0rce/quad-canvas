// apps/web — pure placement helpers (no DOM/React), unit-tested in the node test env. The canvas
// view glues these to clicks + fetch.

export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** Map a pointer position (within a rendered canvas `rect`) to a cell, or null if outside the grid. */
export function cellFromPoint(
  rect: Rect,
  clientX: number,
  clientY: number,
  cols: number,
  rows: number,
): { x: number; y: number } | null {
  if (rect.width <= 0 || rect.height <= 0 || cols <= 0 || rows <= 0) return null;
  const x = Math.floor(((clientX - rect.left) / rect.width) * cols);
  const y = Math.floor(((clientY - rect.top) / rect.height) * rows);
  if (x < 0 || y < 0 || x >= cols || y >= rows) return null;
  return { x, y };
}

/** Map a placement HTTP response to a user-facing message. `COOLDOWN_ACTIVE` ≠ `RATE_LIMITED`. */
export function placementStatusMessage(status: number, errorCode?: string, errorMessage?: string): string {
  switch (status) {
    case 201:
      return 'Pixel placed.';
    case 401:
      return 'Sign in to place a pixel.';
    case 403:
      return 'You are not allowed to place here.';
    case 404:
      return 'No active canvas is open for placement.';
    case 422:
      return errorMessage ?? 'That placement was not valid.';
    case 429:
      return errorCode === 'COOLDOWN_ACTIVE'
        ? 'On cooldown — wait a moment before placing again.'
        : 'Too many requests — slow down.';
    default:
      return errorMessage ?? 'Could not place the pixel. Try again.';
  }
}
