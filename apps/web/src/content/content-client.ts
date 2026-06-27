// apps/web — read-only content fetchers (profiles, leaderboards) + a pure ordinal helper. DC2 reads:
// no email is ever requested or shown. Same tenant-host constraint as the canvas (relative URLs
// preserve the browser's tenant Host; a cross-origin NEXT_PUBLIC_API_BASE must forward it).
import type { dto } from '@quad/core';

const API_BASE = process.env['NEXT_PUBLIC_API_BASE'] ?? '';

export async function fetchProfile(handle: string): Promise<dto.ProfileResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/profiles/${encodeURIComponent(handle)}`, { credentials: 'include' });
    if (!res.ok) return null;
    const body = (await res.json()) as unknown;
    // Validate the field the caller renders (the heatmap maps `contributions`); a wrong-shaped 200
    // (incl. an array or `{}`) degrades to "not found" instead of crashing the page later.
    if (!body || typeof body !== 'object' || !Array.isArray((body as { contributions?: unknown }).contributions)) return null;
    return body as dto.ProfileResponse;
  } catch {
    return null;
  }
}

export async function fetchLeaderboard(): Promise<dto.LeaderboardResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/leaderboards`);
    if (!res.ok) return null;
    const body = (await res.json()) as unknown;
    // The page maps `entries`; reject a wrong-shaped 200 (array/`{}`/missing field) rather than crash.
    if (!body || typeof body !== 'object' || !Array.isArray((body as { entries?: unknown }).entries)) return null;
    return body as dto.LeaderboardResponse;
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
