'use client';

// apps/web — replay player for a past term. Scrub or play through the term's evolution by driving the
// point-in-time endpoint (/at/{seq}) and painting each reconstructed frame. Responses are cacheable
// (immutable archive), so scrubbing is cheap; a stale-render guard drops out-of-order frames.
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { fetchArchiveAt, fetchReplayMeta } from '@/archives/archives-client';
import { paintSnapshot } from '@/archives/paint-snapshot';
import { replayStep, nextReplaySeq, frameInterval, isReplayFrameCurrent } from '@/archives/replay';
import { useTenant } from '@/components/tenant-provider';

const CELL_PX = 8;
const FRAME_MS = 200;

export default function ReplayPage(): React.ReactElement {
  const tenant = useTenant();
  const params = useParams();
  const raw = params['term'];
  const term = typeof raw === 'string' ? raw : Array.isArray(raw) ? (raw[0] ?? '') : '';
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [maxSeq, setMaxSeq] = useState<number | null>(null);
  const [seq, setSeq] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [missing, setMissing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [renderedSeq, setRenderedSeq] = useState<number | null>(null);
  const [failedSeq, setFailedSeq] = useState<number | null>(null);

  // Load the term's seq range; start at the final state.
  useEffect(() => {
    if (!term) return;
    let active = true;
    void fetchReplayMeta(term).then((m) => {
      if (!active) return;
      if (m.status === 'missing') {
        setMissing(true); // a real 404 — terminal
        return;
      }
      if (m.status === 'error') {
        setLoadError(true); // transient — retryable, not "not found"
        return;
      }
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

  const frameIsCurrent = isReplayFrameCurrent(seq, renderedSeq);
  const frameError = failedSeq === seq;

  return (
    <main style={{ padding: '1rem' }}>
      <p>
        <Link href={`/archives/${encodeURIComponent(term)}`}>← {term}</Link>
      </p>
      <h1>Replay — {term}</h1>
      {missing ? (
        <p>No archive for that term.</p>
      ) : loadError ? (
        <p>Couldn’t load the replay — reload to try again.</p>
      ) : maxSeq === null ? (
        <p>Loading…</p>
      ) : (
        <>
          <canvas
            ref={canvasRef}
            aria-label={frameIsCurrent ? `Replay of ${term} at sequence ${seq} of ${maxSeq}` : `Loading replay sequence ${seq} of ${maxSeq}`}
            aria-busy={!frameIsCurrent}
            style={{
              imageRendering: 'pixelated',
              maxWidth: '100%',
              display: 'block',
              border: '1px solid #ddd',
              visibility: frameIsCurrent ? 'visible' : 'hidden',
            }}
          />
          {!frameIsCurrent && <p role={frameError ? 'alert' : 'status'}>{frameError ? 'Couldn’t load this replay frame.' : 'Loading frame…'}</p>}
          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button type="button" onClick={togglePlay}>
              {playing ? 'Pause' : 'Play'}
            </button>
            <input
              type="range"
              min={0}
              max={maxSeq}
              value={seq}
              aria-label="Replay position"
              onChange={(e) => {
                setPlaying(false);
                setSeq(Number(e.target.value));
              }}
              style={{ flex: 1 }}
            />
            <span style={{ color: '#666', minWidth: '6ch' }}>
              {seq}/{maxSeq}
            </span>
            <label>
              <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
                Playback speed
              </span>
              <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
                <option value={0.5}>0.5×</option>
                <option value={1}>1×</option>
                <option value={2}>2×</option>
                <option value={4}>4×</option>
              </select>
            </label>
          </div>
        </>
      )}
    </main>
  );
}
