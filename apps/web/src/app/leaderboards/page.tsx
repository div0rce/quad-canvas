'use client';

// apps/web — leaderboard (DC2). Ranked top placers; each links to the member's public profile.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { dto } from '@quad/core';
import { fetchLeaderboard, ordinal } from '@/content/content-client';

export default function LeaderboardsPage(): React.ReactElement {
  // undefined = loading, null = error.
  const [data, setData] = useState<dto.LeaderboardResponse | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    void fetchLeaderboard().then((d) => {
      if (active) setData(d);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main style={{ padding: '1rem', maxWidth: 520 }}>
      <h1>Leaderboard</h1>
      {data === undefined && <p>Loading…</p>}
      {data === null && <p>Could not load the leaderboard.</p>}
      {data && data.entries.length === 0 && <p>No placements yet.</p>}
      {data && data.entries.length > 0 && (
        <ol style={{ listStyle: 'none', padding: 0 }} aria-label="Top placers">
          {data.entries.map((e) => (
            <li key={e.handle} style={{ display: 'flex', gap: '0.75rem', padding: '0.25rem 0', borderBottom: '1px solid #eee' }}>
              <span style={{ minWidth: '3.5ch', textAlign: 'right' }}>{ordinal(e.rank)}</span>
              <Link href={`/profiles/${encodeURIComponent(e.handle)}`} style={{ flex: 1 }}>
                {e.displayName ?? e.handle}
              </Link>
              <span>{e.pixelsPlaced} px</span>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
