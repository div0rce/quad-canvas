// apps/web — read-only content fetchers (profiles, leaderboards) + a pure ordinal helper. DC2 reads:
// no email is ever requested or shown. Same tenant-host constraint as the canvas (relative URLs
// preserve the browser's tenant Host; a cross-origin NEXT_PUBLIC_API_BASE must forward it).
import type { dto } from '@quad/core';

const API_BASE = process.env['NEXT_PUBLIC_API_BASE'] ?? '';

export async function fetchProfile(handle: string): Promise<dto.ProfileResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/profiles/${encodeURIComponent(handle)}`, { credentials: 'include' });
    if (!res.ok) return null;
    return (await res.json()) as dto.ProfileResponse;
  } catch {
    return null;
  }
}

export async function fetchLeaderboard(): Promise<dto.LeaderboardResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/leaderboards`);
    if (!res.ok) return null;
    return (await res.json()) as dto.LeaderboardResponse;
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
