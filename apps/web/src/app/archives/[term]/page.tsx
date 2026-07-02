'use client';

// apps/web — a past term's final canvas + replay metadata. Paints the archived snapshot (static —
// no live updates) by loading it into a @quad/render CanvasBuffer with the resolved tenant palette.
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { dto } from '@quad/core';
import { fetchArchiveSnapshot, fetchReplayMeta, fetchArchiveStats } from '@/archives/archives-client';
import { paintSnapshot, archiveImageFilename } from '@/archives/paint-snapshot';
import { AppBar } from '@/components/ui/app-bar';
import { mainNav } from '@/components/main-nav';
import { SessionBadge } from '@/auth/session-badge';
import { useTenant } from '@/components/tenant-provider';

const CELL_PX = 8;

export default function ArchiveTermPage(): React.ReactElement {
  const params = useParams();
  const raw = params['term'];
  const term = typeof raw === 'string' ? raw : Array.isArray(raw) ? (raw[0] ?? '') : '';
  const tenant = useTenant();
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
        setLoadError(false);
        setMissing(true); // a real 404 — terminal
        return;
      }
      if (snap.status === 'error') {
        setMissing(false);
        setLoadError(true); // transient — retryable, not "not found"
        return;
      }
      setMissing(false);
      setLoadError(false);
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
    <main className="quad-page">
      <p className="quad-board-label">Archives / {term}</p>
      <div className="quad-panel">
        <AppBar
          tenantLabel={tenant?.title ?? null}
          nav={mainNav('archive')}
          right={<SessionBadge />}
        />
        <div style={{ padding: 'clamp(16px, 4vw, 28px)' }}>
          <p style={{ margin: '0 0 14px' }}>
            <Link href="/archives" className="quad-eyebrow" style={{ textDecoration: 'none' }}>
              ← Archives
            </Link>
          </p>
          <h1 className="quad-pixel" style={{ fontSize: 24, color: 'var(--ink)', margin: '0 0 20px' }}>
            {term}
          </h1>

          {missing ? (
            <p style={{ fontSize: 21, color: 'var(--muted)' }}>No archive for that term.</p>
          ) : loadError ? (
            <p style={{ fontSize: 21, color: 'var(--live-red)' }}>Couldn’t load this archive — reload to try again.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 22, alignItems: 'flex-start' }}>
              {/* Canvas-well frame. The live <canvas ref> stays mounted whenever the term exists so
                  paintSnapshot can draw into it; only the surrounding frame is re-skinned. */}
              <div
                className="quad-card quad-card--card"
                style={{
                  flex: '2 1 360px',
                  maxWidth: '100%',
                  minWidth: 0,
                  boxSizing: 'border-box',
                  background: 'var(--canvas-well)',
                  padding: 12,
                  lineHeight: 0,
                }}
              >
                <canvas
                  ref={canvasRef}
                  className="quad-canvas"
                  aria-label={`Final canvas for ${term}`}
                  style={{ maxWidth: '100%', display: 'block' }}
                />
              </div>

              <div
                style={{
                  flex: '1 1 260px',
                  minWidth: 240,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 18,
                }}
              >
                {stats && (
                  <section aria-labelledby="term-stats-heading" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <h2 id="term-stats-heading" className="quad-pixel" style={{ fontSize: 16, color: 'var(--ink)', margin: 0 }}>
                      Term statistics
                    </h2>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <div className="quad-card quad-card--sm" style={{ padding: '12px 16px', minWidth: 120, flex: 1 }}>
                        <div className="quad-stat-value" style={{ fontSize: 18 }}>{stats.totalPlacements.toLocaleString()}</div>
                        <div className="quad-stat-label" style={{ marginTop: 6 }}>Pixels placed</div>
                      </div>
                      <div className="quad-card quad-card--sm" style={{ padding: '12px 16px', minWidth: 120, flex: 1 }}>
                        <div className="quad-stat-value" style={{ fontSize: 18 }}>{stats.participants.toLocaleString()}</div>
                        <div className="quad-stat-label" style={{ marginTop: 6 }}>
                          Participant{stats.participants === 1 ? '' : 's'}
                        </div>
                      </div>
                    </div>

                    {stats.topPlacers.length > 0 && (
                      <div className="quad-card" style={{ padding: 16 }}>
                        <p className="quad-eyebrow" style={{ margin: '0 0 12px' }}>Top placers</p>
                        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
                          {stats.topPlacers.map((c, i) => (
                            <li
                              key={c.handle}
                              style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}
                            >
                              <span style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
                                <span className="quad-pixel" style={{ fontSize: 12, color: 'var(--muted)' }}>{i + 1}</span>
                                <span style={{ fontSize: 19, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {c.displayName ?? c.handle}
                                </span>
                              </span>
                              <span className="quad-pixel" style={{ fontSize: 12, color: 'var(--ink)', flex: 'none' }}>
                                {c.pixelsPlaced.toLocaleString()}
                              </span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </section>
                )}

                <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                  <a className="quad-btn quad-btn--primary" href={`/archives/${encodeURIComponent(term)}/replay`}>
                    Watch replay
                  </a>
                  <button type="button" className="quad-btn" onClick={downloadImage} aria-label="Download final image">
                    Image
                  </button>
                </div>

                {meta && (
                  <p style={{ fontSize: 18, color: 'var(--muted)', margin: 0 }}>
                    {meta.eventCount.toLocaleString()} events (seq {meta.fromSeq}–{meta.toSeq})
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
