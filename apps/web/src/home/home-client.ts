// apps/web — data + pure helpers for the signed-in dashboard (/home). Reads existing public
// endpoints (canvas meta, DC2 profile); the session identity comes from GET /session upstream.
import type { dto } from '@quad/core';
import { isCanvasMetaResponse, isCanvasRecentPlacementsResponse } from '@/lib/api-response';
import { apiPath } from '@/lib/api-base';

/** The newest placements on the current canvas (the live feed), or [] on failure. */
export async function fetchRecentPlacements(limit: number): Promise<readonly dto.CanvasRecentPlacement[]> {
  try {
    const res = await fetch(apiPath(`/api/v1/canvas/current/placements/recent?limit=${limit}`));
    if (!res.ok) return [];
    const body: unknown = await res.json();
    return isCanvasRecentPlacementsResponse(body) ? body.data : [];
  } catch {
    return [];
  }
}

/** The current active canvas metadata, or null if none/unreachable. */
export async function fetchCanvasMeta(): Promise<dto.CanvasMetaResponse | null> {
  try {
    const res = await fetch(apiPath('/api/v1/canvas/current'));
    if (!res.ok) return null;
    const body: unknown = await res.json();
    return isCanvasMetaResponse(body) ? body : null;
  } catch {
    return null;
  }
}

/** A friendly first name for the welcome line: the display name if set, else the @handle. */
export function welcomeName(handle: string, displayName?: string): string {
  const clean = handle.replace(/^@/, '');
  return displayName?.trim() || clean || 'placer';
}

/** "1,482 placed · 612 surviving" — a compact lifetime summary line. */
export function statsSummary(profile: dto.ProfileResponse | null): string {
  if (!profile) return '—';
  const placed = profile.pixelsPlaced.toLocaleString('en-US');
  const surviving = profile.lifetimeStats.survivingPixels.toLocaleString('en-US');
  return `${placed} placed · ${surviving} surviving`;
}

/** "40 × 30" board size, or null when the canvas is unknown. */
export function boardSize(canvas: dto.CanvasMetaResponse | null): string | null {
  return canvas ? `${canvas.width} × ${canvas.height}` : null;
}
