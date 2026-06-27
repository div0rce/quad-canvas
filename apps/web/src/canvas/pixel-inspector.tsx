'use client';

// apps/web — pixel inspector. Shows the selected cell's placement history (DC2: color + owner handle
// + time). Sanitized server-side (rolled-back placements are excluded from public history).
import { useEffect, useState } from 'react';
import type { dto } from '@quad/core';
import { colorHex, colorName, fetchPixelHistory } from './inspector-client';

export function PixelInspector({ x, y, palette }: { x: number; y: number; palette: string }): React.ReactElement {
  // undefined = loading, null = error.
  const [data, setData] = useState<dto.PixelHistoryListResponse | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    void fetchPixelHistory(x, y).then((d) => {
      if (active) setData(d);
    });
    return () => {
      active = false;
    };
  }, [x, y]);

  return (
    <div role="region" aria-label={`History for cell ${x}, ${y}`} style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
      {data === undefined && <span>Loading history…</span>}
      {data === null && <span>Could not load history.</span>}
      {data && data.data.length === 0 && <span>No placements at this cell yet.</span>}
      {data && data.data.length > 0 && (
        // Newest first — most recent placement at the top.
        <ol style={{ margin: 0, paddingLeft: '1.2rem' }}>
          {[...data.data].reverse().map((e) => (
            <li key={e.seq}>
              <span
                aria-hidden
                style={{
                  display: 'inline-block',
                  width: 12,
                  height: 12,
                  background: colorHex(palette, e.color),
                  border: '1px solid #999',
                  verticalAlign: 'middle',
                  marginRight: '0.4rem',
                }}
              />
              {colorName(palette, e.color)} · {e.owner?.handle ?? 'unknown'} · {new Date(e.placedAt).toLocaleString()}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
