// apps/web — read-only content fetchers (profiles, leaderboards) + a pure ordinal helper. DC2 reads:
// no email is ever requested or shown. Same tenant-host constraint as the canvas (relative URLs
// preserve the browser's tenant Host; a cross-origin NEXT_PUBLIC_API_BASE must forward it).
import type { dto } from '@quad/core';
import { isLeaderboardResponse, isProfileResponse } from '@/lib/api-response';
import { apiPath } from '@/lib/api-base';

export async function fetchProfile(handle: string): Promise<dto.ProfileResponse | null> {
  try {
    const res = await fetch(apiPath(`/api/v1/profiles/${encodeURIComponent(handle)}`), { credentials: 'include' });
    if (!res.ok) return null;
    const body = (await res.json()) as unknown;
    return isProfileResponse(body) ? body : null;
  } catch {
    return null;
  }
}

export type LeaderboardCategory = 'placements' | 'surviving';
export type LeaderboardWindow = 'all' | 'today';

export async function fetchLeaderboard(
  query: {
    readonly category?: LeaderboardCategory;
    readonly window?: LeaderboardWindow;
    readonly limit?: number;
  } = {},
): Promise<dto.LeaderboardResponse | null> {
  try {
    const params = new URLSearchParams();
    if (query.category) params.set('category', query.category);
    if (query.window) params.set('window', query.window);
    if (query.limit !== undefined) params.set('limit', String(query.limit));
    const suffix = params.size > 0 ? `?${params.toString()}` : '';
    const res = await fetch(apiPath(`/api/v1/leaderboards${suffix}`), { credentials: 'include' });
    if (!res.ok) return null;
    const body = (await res.json()) as unknown;
    return isLeaderboardResponse(body) ? body : null;
  } catch {
    return null;
  }
}

/** English ordinal for a rank (1 → "1st", 2 → "2nd", 11 → "11th", 21 → "21st"). */
export function ordinal(n: number): string {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${suffixes[(v - 20) % 10] ?? suffixes[v] ?? suffixes[0]}`;
}

/** Heat bucket (0–4) for a day's count relative to the busiest day, for the contribution heatmap. */
export function heatLevel(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0;
  return Math.min(4, Math.ceil((count / max) * 4));
}
