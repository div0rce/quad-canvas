// apps/web — pixel inspector data: a cell's placement history (DC2 attribution) + a pure palette
// color lookup. Public read (same tenant-host constraint as the rest of the web app).
import type { dto } from '@quad/core';
import { getPaletteByKey } from '@quad/config';
import { fetchAllPages } from '@/lib/fetch-all-pages';
import { apiPath } from '@/lib/api-base';

function isHistoryEntry(value: unknown): value is dto.PixelHistoryEntry {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item['color'] === 'number' && typeof item['seq'] === 'number' && typeof item['placedAt'] === 'string';
}

export async function fetchPixelHistory(x: number, y: number): Promise<dto.PixelHistoryListResponse | null> {
  try {
    return await fetchAllPages(
      apiPath(`/api/v1/canvas/current/pixels/${x}/${y}/history?limit=200`),
      undefined,
      isHistoryEntry,
    );
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
