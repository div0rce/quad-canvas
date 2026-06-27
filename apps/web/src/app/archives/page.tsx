'use client';

// apps/web — archives index. Lists past-term canvases; each links to its final-state view.
import { useEffect, useState } from 'react';
import type { dto } from '@quad/core';
import { fetchArchives } from '@/archives/archives-client';

export default function ArchivesPage(): React.ReactElement {
  const [data, setData] = useState<dto.ArchiveListResponse | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    void fetchArchives().then((d) => {
      if (active) setData(d);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main style={{ padding: '1rem', maxWidth: 520 }}>
      <h1>Archives</h1>
      {data === undefined && <p>Loading…</p>}
      {data === null && <p>Could not load archives.</p>}
      {data && data.data.length === 0 && <p>No past terms yet.</p>}
      {data && data.data.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0 }} aria-label="Past terms">
          {data.data.map((a) => (
            <li key={a.id} style={{ padding: '0.4rem 0', borderBottom: '1px solid #eee' }}>
              <a href={`/archives/${encodeURIComponent(a.term)}`}>{a.term}</a> — {a.width}×{a.height}{' '}
              <span style={{ color: '#666' }}>({new Date(a.createdAt).toLocaleDateString()})</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
