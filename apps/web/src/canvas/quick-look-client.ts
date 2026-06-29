// apps/web — pixel quick-look: the CURRENT cell's owner + time (a lightweight hover preview, distinct
// from the full click-to-open history in the inspector). Public read; DC2 (handle only, never email).
import type { dto } from '@quad/core';

const API_BASE = process.env['NEXT_PUBLIC_API_BASE'] ?? '';

export type CurrentPixelResult =
  | { readonly kind: 'pixel'; readonly pixel: dto.PixelResponse }
  | { readonly kind: 'empty' }
  | { readonly kind: 'unavailable' };

/** Current cell state. A real 404 is empty; transport/server failures remain distinguishable. */
export async function fetchCurrentPixel(x: number, y: number): Promise<CurrentPixelResult> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/canvas/current/pixels/${x}/${y}`);
    if (res.status === 404) return { kind: 'empty' };
    if (!res.ok) return { kind: 'unavailable' };
    return { kind: 'pixel', pixel: (await res.json()) as dto.PixelResponse };
  } catch {
    return { kind: 'unavailable' };
  }
}

/** One-line quick-look label with the current color, public owner, and placement time. */
export function quickLookLabel(result: CurrentPixelResult, colorName?: string): string {
  if (result.kind === 'empty') return 'Empty';
  if (result.kind === 'unavailable') return 'Unavailable';
  const { pixel } = result;
  const who = pixel.owner?.handle ?? 'unknown'; // a placed cell whose placer has no public handle
  const color = colorName ?? `Color ${pixel.color}`;
  return pixel.placedAt ? `${color} · ${who} · ${new Date(pixel.placedAt).toLocaleString()}` : `${color} · ${who}`;
}
