'use client';

// apps/web — a past term's final canvas + replay metadata. Paints the archived snapshot (static —
// no live updates) by loading it into a @quad/render CanvasBuffer. The tenant palette is assumed
// 'default' (single tenant); carrying the palette in the archive metadata is a follow-up.
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import type { dto } from '@quad/core';
import { fetchArchiveSnapshot, fetchReplayMeta } from '@/archives/archives-client';
import { paintSnapshot } from '@/archives/paint-snapshot';

const CELL_PX = 8;
const PALETTE = 'default';

export default function ArchiveTermPage(): React.ReactElement {
  const params = useParams();
  const raw = params['term'];
  const term = typeof raw === 'string' ? raw : Array.isArray(raw) ? (raw[0] ?? '') : '';
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [meta, setMeta] = useState<dto.ReplayMetaResponse | null | undefined>(undefined);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!term) return;
    let active = true;
    void (async () => {
      const [snap, replay] = await Promise.all([fetchArchiveSnapshot(term), fetchReplayMeta(term)]);
      if (!active) return;
      setMeta(replay ?? null);
      if (!snap) {
        setMissing(true);
        return;
      }
      const canvas = canvasRef.current;
      if (canvas) paintSnapshot(canvas, snap, PALETTE, CELL_PX);
    })();
    return () => {
      active = false;
    };
  }, [term]);

  return (
    <main style={{ padding: '1rem' }}>
      <p>
        <a href="/archives">← Archives</a>
      </p>
      <h1>{term}</h1>
      {missing ? (
        <p>No archive for that term.</p>
      ) : (
        <>
          <canvas ref={canvasRef} aria-label={`Final canvas for ${term}`} style={{ imageRendering: 'pixelated', maxWidth: '100%' }} />
          {meta && (
            <p style={{ color: '#666' }}>
              {meta.eventCount} events (seq {meta.fromSeq}–{meta.toSeq}) ·{' '}
              <a href={`/archives/${encodeURIComponent(term)}/replay`}>Replay ▸</a>
            </p>
          )}
        </>
      )}
    </main>
  );
}
