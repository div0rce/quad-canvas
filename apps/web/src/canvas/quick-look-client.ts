// apps/web — pixel quick-look: the CURRENT cell's owner + time (a lightweight hover preview, distinct
// from the full click-to-open history in the inspector). Public read; DC2 (handle only, never email).
import type { dto } from '@quad/core';

const API_BASE = process.env['NEXT_PUBLIC_API_BASE'] ?? '';

/** Current cell state, or null when the cell is empty (404) or unreachable. */
export async function fetchCurrentPixel(x: number, y: number): Promise<dto.PixelResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/canvas/current/pixels/${x}/${y}`);
    return res.ok ? ((await res.json()) as dto.PixelResponse) : null;
  } catch {
    return null;
  }
}

/** One-line quick-look label: "handle · time" for a placed cell ("unknown" if the placer has no public
 *  handle), or "Empty" for an unplaced/unreachable cell. */
export function quickLookLabel(pixel: dto.PixelResponse | null): string {
  if (!pixel) return 'Empty'; // 404 / empty / unreachable
  const who = pixel.owner?.handle ?? 'unknown'; // a placed cell whose placer has no public handle
  return pixel.placedAt ? `${who} · ${new Date(pixel.placedAt).toLocaleString()}` : who;
}
