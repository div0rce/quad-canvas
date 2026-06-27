// apps/web — pixel inspector data: a cell's placement history (DC2 attribution) + a pure palette
// color lookup. Public read (same tenant-host constraint as the rest of the web app).
import type { dto } from '@quad/core';
import { getPaletteByKey } from '@quad/config';

const API_BASE = process.env['NEXT_PUBLIC_API_BASE'] ?? '';

// A cell's full lineage is small; request the max page so all entries (incl. the most recent) are
// shown without cursor paging. (A pathological >200-placement cell would still be capped — rare.)
export async function fetchPixelHistory(x: number, y: number): Promise<dto.PixelHistoryListResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/canvas/current/pixels/${x}/${y}/history?limit=200`);
    if (!res.ok) return null;
    return (await res.json()) as dto.PixelHistoryListResponse;
  } catch {
    return null;
  }
}

/** Hex for a color index in a palette, or a neutral fallback for an unknown palette/index. */
export function colorHex(paletteKey: string, index: number): string {
  return getPaletteByKey(paletteKey)?.colors.find((c) => c.index === index)?.hex ?? '#cccccc';
}

/** Human color name for a palette index (for accessible text alongside the swatch). */
export function colorName(paletteKey: string, index: number): string {
  return getPaletteByKey(paletteKey)?.colors.find((c) => c.index === index)?.name ?? `color ${index}`;
}
