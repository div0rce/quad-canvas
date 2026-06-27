'use client';

// apps/web — live canvas view + placement. Drives the framework-agnostic CanvasClient and paints the
// buffer's dirty regions to a <canvas>. Placement is a TWO-STEP confirm: click a cell to select it,
// then pick a color and Confirm — the write POSTs to the server (the authoritative path) with the
// session cookie and an idempotency key, and the result returns as a WS delta. Anonymous users get a
// clear "sign in" message (no anonymous writes). Server-authoritative: the UI never mutates locally.
import { useCallback, useEffect, useRef, useState } from 'react';
import { getPaletteByKey } from '@quad/config';
import type { CanvasBuffer } from '@quad/render';
import { EMPTY_CELL } from '@quad/render';
import type { dto } from '@quad/core';
import { CanvasClient, type SocketLike } from './canvas-client';
import { cellFromPoint, placementStatusMessage } from './placement';
import { formatCountdown, remainingMs } from './cooldown';
import { ReportControl } from './report-control';
import { PixelInspector } from './pixel-inspector';

// The API must be reached at the TENANT host so it resolves the tenant from the Host header.
// Default '' = same-origin (relative URLs) preserves the browser's tenant host.
const API_BASE = process.env['NEXT_PUBLIC_API_BASE'] ?? '';
const CELL_PX = 8;
const EMPTY_HEX = '#F4F4F4';

interface Dims {
  readonly width: number;
  readonly height: number;
  readonly palette: string;
}

function paint(canvas: HTMLCanvasElement | null, buffer: CanvasBuffer, paletteKey: string): void {
  if (!canvas) return;
  const palette = getPaletteByKey(paletteKey);
  if (canvas.width !== buffer.width * CELL_PX) canvas.width = buffer.width * CELL_PX;
  if (canvas.height !== buffer.height * CELL_PX) canvas.height = buffer.height * CELL_PX;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  for (const cell of buffer.drainDirty()) {
    const hex = cell.color === EMPTY_CELL ? EMPTY_HEX : (palette?.colors.find((c) => c.index === cell.color)?.hex ?? EMPTY_HEX);
    ctx.fillStyle = hex;
    ctx.fillRect(cell.x * CELL_PX, cell.y * CELL_PX, CELL_PX, CELL_PX);
  }
}

export function CanvasView(): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clientRef = useRef<CanvasClient | null>(null);
  const [dims, setDims] = useState<Dims | null>(null);
  const [selected, setSelected] = useState<{ x: number; y: number } | null>(null);
  const [pendingColor, setPendingColor] = useState<number | null>(null);
  const [status, setStatus] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [inspectorNonce, setInspectorNonce] = useState(0); // bumps to refetch the inspector after a placement
  const [cooldownUntil, setCooldownUntil] = useState(0); // epoch ms the cooldown ends (display only)
  const [nowTick, setNowTick] = useState(0); // re-render driver while a countdown is running

  // Tick once a second while a cooldown is pending so the countdown updates (server still enforces).
  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [cooldownUntil, nowTick]);

  const cooldownRemainingMs = remainingMs(cooldownUntil, Date.now());

  useEffect(() => {
    const wsBase = (API_BASE || window.location.origin).replace(/^http/, 'ws');
    const client = new CanvasClient({
      fetchMeta: async () => {
        const meta = (await (await fetch(`${API_BASE}/api/v1/canvas/current`)).json()) as dto.CanvasMetaResponse;
        setDims({ width: meta.width, height: meta.height, palette: meta.palette });
        return meta;
      },
      fetchSnapshot: async () =>
        (await fetch(`${API_BASE}/api/v1/canvas/current/snapshot`)).json() as Promise<dto.CanvasSnapshotResponse>,
      openSocket: () => new WebSocket(`${wsBase}/api/v1/canvas/current/ws`) as unknown as SocketLike,
      onUpdate: (buffer, ctx) => paint(canvasRef.current, buffer, ctx.palette),
    });
    clientRef.current = client;
    void client.start();
    return () => {
      client.stop();
      clientRef.current = null;
    };
  }, []);

  const onCanvasClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || !dims || submitting) return; // ignore clicks while a placement is in flight
      const cell = cellFromPoint(canvas.getBoundingClientRect(), event.clientX, event.clientY, dims.width, dims.height);
      if (cell) {
        setSelected(cell); // step 1 — select the cell
        setPendingColor(null);
        setStatus('');
      }
    },
    [dims, submitting],
  );

  const confirm = useCallback(async () => {
    if (!selected || pendingColor === null || submitting) return; // single in-flight placement only
    setSubmitting(true);
    setStatus('Placing…');
    try {
      const res = await fetch(`${API_BASE}/api/v1/canvas/current/pixels`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
        credentials: 'include', // send the session cookie; anonymous → 401
        body: JSON.stringify({ at: selected, color: pendingColor }),
      });
      if (res.status === 201) {
        // Apply the AUTHORITATIVE result to the buffer so the pixel shows even if the WS is mid-
        // reconnect; the seq watermark dedupes the matching live delta when it arrives.
        const result = (await res.json().catch(() => null)) as dto.PlacePixelResultResponse | null;
        const buffer = clientRef.current?.buffer;
        if (result && buffer) {
          buffer.applyDelta({ type: 'PixelPlaced', at: result.at, color: result.color, seq: result.seq });
          paint(canvasRef.current, buffer, dims?.palette ?? 'default');
        }
        if (result && result.cooldownMs > 0) setCooldownUntil(Date.now() + result.cooldownMs); // display the countdown
        setStatus(placementStatusMessage(201));
        setPendingColor(null);
        setInspectorNonce((n) => n + 1); // keep the cell selected; refresh its history to show the placement
      } else {
        const body = (await res.json().catch(() => null)) as
          | { error?: { code?: string; message?: string; details?: { retryAfterMs?: number } } }
          | null;
        // The server is on cooldown — reflect its retry-after as the countdown.
        const retryAfterMs = body?.error?.details?.retryAfterMs;
        if (typeof retryAfterMs === 'number' && retryAfterMs > 0) setCooldownUntil(Date.now() + retryAfterMs);
        setStatus(placementStatusMessage(res.status, body?.error?.code, body?.error?.message));
      }
    } catch {
      setStatus('Network error — could not reach the server.');
    } finally {
      setSubmitting(false);
    }
  }, [selected, pendingColor, submitting, dims]);

  const cancel = useCallback(() => {
    setSelected(null);
    setPendingColor(null);
    setStatus('');
  }, []);

  const palette = dims ? getPaletteByKey(dims.palette) : null;

  return (
    <div>
      <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
        <canvas
          ref={canvasRef}
          onClick={onCanvasClick}
          aria-label="Live canvas — click a cell to place a pixel"
          style={{ imageRendering: 'pixelated', width: '100%', display: 'block', cursor: dims ? 'crosshair' : 'default' }}
        />
        {selected && dims && (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              left: `${(selected.x / dims.width) * 100}%`,
              top: `${(selected.y / dims.height) * 100}%`,
              width: `${100 / dims.width}%`,
              height: `${100 / dims.height}%`,
              outline: '2px solid #CC0033',
              boxSizing: 'border-box',
              pointerEvents: 'none',
            }}
          />
        )}
      </div>

      {selected && (
        <div
          role="dialog"
          aria-label="Place a pixel"
          style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}
        >
          <span>
            Cell ({selected.x}, {selected.y}):
          </span>
          <div role="group" aria-label="Choose a color" style={{ display: 'flex', gap: '0.25rem' }}>
            {palette?.colors.map((c) => (
              <button
                key={c.index}
                type="button"
                aria-label={c.name}
                aria-pressed={pendingColor === c.index}
                disabled={submitting}
                onClick={() => setPendingColor(c.index)}
                style={{
                  width: 28,
                  height: 28,
                  background: c.hex,
                  border: pendingColor === c.index ? '3px solid #000' : '1px solid #999',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={pendingColor === null || submitting || cooldownRemainingMs > 0}
          >
            {submitting ? 'Placing…' : cooldownRemainingMs > 0 ? `Wait ${formatCountdown(cooldownRemainingMs)}` : 'Confirm'}
          </button>
          <button type="button" onClick={cancel} disabled={submitting}>
            Cancel
          </button>
          <ReportControl key={`${selected.x},${selected.y}`} x={selected.x} y={selected.y} />
        </div>
      )}

      {selected && dims && (
        <PixelInspector key={`${selected.x},${selected.y}:${inspectorNonce}`} x={selected.x} y={selected.y} palette={dims.palette} />
      )}

      <p role="status" aria-live="polite" style={{ minHeight: '1.2em', margin: '0.5rem 0 0' }}>
        {status}
      </p>
    </div>
  );
}
