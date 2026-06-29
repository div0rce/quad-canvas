'use client';

// apps/web — a past term's final canvas + replay metadata. Paints the archived snapshot (static —
// no live updates) by loading it into a @quad/render CanvasBuffer with the resolved tenant palette.
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { dto } from '@quad/core';
import { fetchArchiveSnapshot, fetchReplayMeta, fetchArchiveStats } from '@/archives/archives-client';
import { paintSnapshot, archiveImageFilename } from '@/archives/paint-snapshot';
import { useTenant } from '@/components/tenant-provider';

const CELL_PX = 8;

export default function ArchiveTermPage(): React.ReactElement {
  const tenant = useTenant();
  const params = useParams();
  const raw = params['term'];
  const term = typeof raw === 'string' ? raw : Array.isArray(raw) ? (raw[0] ?? '') : '';
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [meta, setMeta] = useState<dto.ReplayMetaResponse | null | undefined>(undefined);
  const [stats, setStats] = useState<dto.ArchiveStatsResponse | null>(null);
  const [missing, setMissing] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!term) return;
    let active = true;
    void (async () => {
      const [snap, replay, termStats] = await Promise.all([fetchArchiveSnapshot(term), fetchReplayMeta(term), fetchArchiveStats(term)]);
      if (!active) return;
      setMeta(replay.status === 'ok' ? replay.data : null);
      setStats(termStats);
      if (snap.status === 'missing') {
        setMissing(true); // a real 404 — terminal
        return;
      }
      if (snap.status === 'error') {
        setLoadError(true); // transient — retryable, not "not found"
        return;
      }
      const canvas = canvasRef.current;
      if (canvas && tenant) paintSnapshot(canvas, snap.data, tenant.palette, CELL_PX);
    })();
    return () => {
      active = false;
    };
  }, [term, tenant]);

  const downloadImage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = archiveImageFilename(term);
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Defer the revoke — some browsers cancel an in-flight download if the URL is revoked synchronously.
      setTimeout(() => URL.revokeObjectURL(url), 0);
    }, 'image/png');
  }, [term]);

  return (
    <main style={{ padding: '1rem' }}>
      <p>
        <Link href="/archives">← Archives</Link>
      </p>
      <h1>{term}</h1>
      {missing ? (
        <p>No archive for that term.</p>
      ) : loadError ? (
        <p>Couldn’t load this archive — reload to try again.</p>
      ) : (
        <>
          <canvas ref={canvasRef} aria-label={`Final canvas for ${term}`} style={{ imageRendering: 'pixelated', maxWidth: '100%' }} />
          <p style={{ color: '#666' }}>
            <Link href={`/archives/${encodeURIComponent(term)}/replay`}>Replay ▸</Link> ·{' '}
            <button type="button" onClick={downloadImage} style={{ font: 'inherit', cursor: 'pointer' }}>
              Download image
            </button>
            {meta && (
              <>
                {' '}
                · {meta.eventCount} events (seq {meta.fromSeq}–{meta.toSeq})
              </>
            )}
          </p>
          {stats && (
            <section aria-label="Term statistics">
              <h2 style={{ fontSize: '1rem' }}>Term statistics</h2>
              <p style={{ color: '#666' }}>
                {stats.totalPlacements} placements by {stats.participants} participant{stats.participants === 1 ? '' : 's'}
              </p>
              {stats.topPlacers.length > 0 && (
                <ol>
                  {stats.topPlacers.map((c) => (
                    <li key={c.handle}>
                      {c.displayName ?? c.handle} — {c.pixelsPlaced}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}
