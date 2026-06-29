'use client';

// apps/web — replay player for a past term. Scrub or play through the term's evolution by driving the
// point-in-time endpoint (/at/{seq}) and painting each reconstructed frame. Responses are cacheable
// (immutable archive), so scrubbing is cheap; a stale-render guard drops out-of-order frames.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { fetchArchiveAt, fetchReplayMeta } from '@/archives/archives-client';
import { paintSnapshot } from '@/archives/paint-snapshot';
import { replayStep, nextReplaySeq, frameInterval, isReplayFrameCurrent } from '@/archives/replay';
import { AppBar } from '@/components/ui/app-bar';
import { useTenant } from '@/components/tenant-provider';

const CELL_PX = 8;
const FRAME_MS = 200;
// The real playback-speed set (matches the seek/play timing the player already supports).
const SPEEDS = [0.5, 1, 2, 4] as const;

export default function ReplayPage(): React.ReactElement {
  const params = useParams();
  const raw = params['term'];
  const term = typeof raw === 'string' ? raw : Array.isArray(raw) ? (raw[0] ?? '') : '';
  const tenant = useTenant();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [maxSeq, setMaxSeq] = useState<number | null>(null);
  const [seq, setSeq] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [missing, setMissing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [renderedSeq, setRenderedSeq] = useState<number | null>(null);
  const [failedSeq, setFailedSeq] = useState<number | null>(null);
  const [scrubFocus, setScrubFocus] = useState(false); // keyboard focus cue for the visual thumb

  // Load the term's seq range; start at the final state.
  useEffect(() => {
    if (!term) return;
    let active = true;
    void fetchReplayMeta(term).then((m) => {
      if (!active) return;
      if (m.status === 'missing') {
        setLoadError(false);
        setMissing(true); // a real 404 — terminal
        return;
      }
      if (m.status === 'error') {
        setMissing(false);
        setLoadError(true); // transient — retryable, not "not found"
        return;
      }
      setMissing(false);
      setLoadError(false);
      setMaxSeq(m.data.toSeq);
      setSeq(m.data.toSeq);
    });
    return () => {
      active = false;
    };
  }, [term]);

  // Render the reconstructed canvas at the current seq.
  useEffect(() => {
    if (!term || maxSeq === null) return;
    let active = true;
    void fetchArchiveAt(term, seq).then((snap) => {
      if (!active) return;
      if (!snap || !tenant) {
        setFailedSeq(seq);
        setPlaying(false);
        return;
      }
      const canvas = canvasRef.current;
      if (canvas) {
        paintSnapshot(canvas, snap, tenant.palette, CELL_PX);
        setRenderedSeq(seq);
      }
    });
    return () => {
      active = false;
    };
  }, [term, seq, maxSeq, tenant]);

  // Play: advance on a timer; stop at the end.
  useEffect(() => {
    if (!playing || maxSeq === null) return;
    const step = replayStep(maxSeq);
    const id = setInterval(() => {
      setSeq((s) => {
        const next = nextReplaySeq(s, maxSeq, step);
        if (next >= maxSeq) setPlaying(false);
        return next;
      });
    }, frameInterval(FRAME_MS, speed));
    return () => clearInterval(id);
  }, [playing, maxSeq, speed]);

  const togglePlay = useCallback(() => {
    setPlaying((p) => {
      if (!p && maxSeq !== null && seq >= maxSeq) {
        setSeq(0); // replay from the start when at the end
        return true;
      }
      return !p;
    });
  }, [maxSeq, seq]);

  // The transport is live only once the seq range is known; until then it loads disabled.
  const ready = maxSeq !== null;
  const frameIsCurrent = isReplayFrameCurrent(seq, renderedSeq);
  const frameError = failedSeq === seq;
  // Progress as a fraction of the term (the app knows seq/maxSeq only — never calendar dates).
  const replayPct = ready && maxSeq > 0 ? seq / maxSeq : 0;
  const pctLabel = Math.round(replayPct * 100);
  const fillWidth = `${replayPct * 100}%`;

  return (
    <main className="quad-page">
      <p className="quad-board-label">Replay / Scrub the semester</p>
      <div className="quad-panel">
        <AppBar
          tenantLabel={tenant?.title ?? null}
          nav={[
            { label: 'Canvas', href: '/canvas' },
            { label: 'Board', href: '/leaderboards' },
            { label: 'Archive', href: '/archives', active: true },
          ]}
          right={<span className="quad-eyebrow">From the permanent history</span>}
        />

        <div style={{ padding: 24 }}>
          <a
            href={`/archives/${encodeURIComponent(term)}`}
            className="quad-eyebrow"
            style={{ display: 'inline-block', marginBottom: 16, textDecoration: 'none' }}
          >
            ← {term}
          </a>

          <div style={{ marginBottom: 18 }}>
            <h1 className="quad-pixel" style={{ fontSize: 22, lineHeight: 1.3, color: 'var(--ink)', margin: 0 }}>
              Watch it unfold
            </h1>
            <p style={{ fontSize: 21, color: 'var(--muted-label)', margin: '9px 0 0' }}>
              From the first blank pixel to the final piece. Drag the scrubber to any moment.
            </p>
          </div>

          {missing ? (
            <div className="quad-card quad-card--card" style={{ padding: 20, fontSize: 20, color: 'var(--ink-strong)' }}>
              No archive for that term.
            </div>
          ) : loadError ? (
            <div className="quad-card quad-card--card" style={{ padding: 20, fontSize: 20, color: 'var(--live-red)' }}>
              Couldn’t load the replay — reload to try again.
            </div>
          ) : (
            <>
              {/* Reconstructed frame. */}
              <div
                style={{
                  position: 'relative',
                  background: 'var(--canvas-well)',
                  border: '3px solid var(--ink)',
                  overflow: 'hidden',
                }}
              >
                <canvas
                  ref={canvasRef}
                  className="quad-canvas"
                  aria-label={
                    frameIsCurrent
                      ? `Replay of ${term} at sequence ${seq} of ${maxSeq}`
                      : ready
                        ? `Loading replay sequence ${seq} of ${maxSeq}`
                        : `Replay of ${term}, loading`
                  }
                  aria-busy={ready ? !frameIsCurrent : true}
                  style={{ display: 'block', width: '100%', height: 'auto', visibility: ready && !frameIsCurrent ? 'hidden' : 'visible' }}
                />
                {ready && !frameIsCurrent && (
                  <p
                    role={frameError ? 'alert' : 'status'}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'grid',
                      placeItems: 'center',
                      margin: 0,
                      background: 'var(--canvas-well)',
                      color: frameError ? 'var(--live-red)' : 'var(--ink)',
                      fontSize: 20,
                    }}
                  >
                    {frameError ? 'Couldn’t load this replay frame.' : 'Loading frame…'}
                  </p>
                )}
                {/* Progress chip — seq-based % of term (no calendar date is available). */}
                <div
                  style={{
                    position: 'absolute',
                    top: 12,
                    left: 12,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 10,
                    background: 'var(--ink)',
                    padding: '7px 13px',
                  }}
                >
                  {ready ? (
                    <>
                      <span className="quad-pixel" style={{ fontSize: 14, color: '#fff' }}>
                        {pctLabel}%
                      </span>
                      <span style={{ fontSize: 16, color: 'var(--muted-fainter)', textTransform: 'uppercase' }}>of term</span>
                    </>
                  ) : (
                    <span style={{ fontSize: 16, color: 'var(--muted-fainter)', textTransform: 'uppercase' }}>Loading…</span>
                  )}
                </div>
              </div>

              {/* Transport card. */}
              <div className="quad-card" style={{ padding: '18px 20px', marginTop: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                  <button
                    type="button"
                    className="quad-btn quad-btn--primary"
                    onClick={togglePlay}
                    disabled={!ready}
                    aria-pressed={playing}
                    style={{ minWidth: 110 }}
                  >
                    {playing ? 'Pause' : 'Play'}
                  </button>

                  {/* Custom scrubber drawn over the native range; fill + thumb track replayPct. */}
                  <div style={{ position: 'relative', flex: 1, height: 26, display: 'flex', alignItems: 'center' }}>
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        height: 14,
                        background: 'var(--paper)',
                        border: '2px solid var(--ink)',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        height: 14,
                        width: fillWidth,
                        background: 'var(--qa)',
                        border: '2px solid var(--ink)',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        left: fillWidth,
                        marginLeft: -8,
                        width: 16,
                        height: 24,
                        background: 'var(--surface)',
                        border: '2px solid var(--ink)',
                        boxShadow: scrubFocus ? '0 0 0 3px var(--qa)' : undefined,
                      }}
                    />
                    <input
                      type="range"
                      min={0}
                      max={maxSeq ?? 0}
                      value={seq}
                      disabled={!ready}
                      aria-label="Replay position"
                      onFocus={() => setScrubFocus(true)}
                      onBlur={() => setScrubFocus(false)}
                      onChange={(e) => {
                        setPlaying(false);
                        setSeq(Number(e.target.value));
                      }}
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        width: '100%',
                        height: 26,
                        margin: 0,
                        opacity: 0,
                        cursor: ready ? 'pointer' : 'not-allowed',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 15, color: 'var(--muted-tag)', textTransform: 'uppercase' }}>Speed</span>
                    <div role="group" aria-label="Playback speed" style={{ display: 'flex', gap: 6 }}>
                      {SPEEDS.map((sp) => {
                        const active = speed === sp;
                        return (
                          <button
                            key={sp}
                            type="button"
                            aria-pressed={active}
                            disabled={!ready}
                            onClick={() => setSpeed(sp)}
                            style={{
                              padding: '7px 12px',
                              border: '2px solid var(--ink)',
                              boxShadow: '2px 2px 0 var(--ink)',
                              fontFamily: 'inherit',
                              fontSize: 16,
                              cursor: ready ? 'pointer' : 'not-allowed',
                              background: active ? 'var(--qa)' : 'var(--surface)',
                              color: active ? '#fff' : 'var(--ink)',
                            }}
                          >
                            {sp}×
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
