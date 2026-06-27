'use client';

// apps/web — live canvas view + placement. Drives the framework-agnostic CanvasClient and paints the
// buffer's dirty regions to a <canvas>. Placement is a TWO-STEP confirm: click a cell to select it,
// then pick a color and Confirm — the write POSTs to the server (the authoritative path) with the
// session cookie and an idempotency key, and the result returns as a WS delta. Anonymous users get a
// clear "sign in" message (no anonymous writes). Server-authoritative: the UI never mutates locally.
import { useCallback, useEffect, useRef, useState } from 'react';
import { getPaletteByKey } from '@quad/config';
import type { CanvasBuffer, Viewport } from '@quad/render';
import { EMPTY_CELL, zoomAt, clampScale } from '@quad/render';
import type { dto } from '@quad/core';
import { CanvasClient, type SocketLike } from './canvas-client';
import { cellFromPoint, placementStatusMessage } from './placement';
import { fetchCurrentPixel, quickLookLabel } from './quick-look-client';
import { clampPan, pinchScale } from './gestures';

const SCALE_MIN = 1; // fit-to-width
const SCALE_MAX = 8;
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
  // Pan/zoom (P-AC-11) — declared up here so the click/hover handlers below can read them.
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<Viewport>({ scale: SCALE_MIN, offsetX: 0, offsetY: 0 });
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<number | null>(null);
  const dragMoved = useRef(false);
  const dragStart = useRef<{ x: number; y: number } | null>(null); // pointer-down origin (cumulative-distance tap test)
  const multiTouched = useRef(false); // a second pointer touched during this gesture → not a tap
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

  // Select the cell at a screen point. Driven by pointer-UP (a tap), not click — with pointer capture a
  // click can target the capturing container rather than the canvas, which would break selection.
  const selectAt = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas || !dims || submitting) return; // ignore while a placement is in flight
      const cell = cellFromPoint(canvas.getBoundingClientRect(), clientX, clientY, dims.width, dims.height);
      if (cell) {
        setSelected(cell); // step 1 — select the cell
        setPendingColor(null);
        setStatus('');
      }
    },
    [dims, submitting],
  );

  // Quick-look: the current cell's owner + time, lighter than the click-to-open history. On desktop it
  // follows the pointer (hover); on every device a selected cell shows the same quick-look line (so touch
  // users — who can't hover — get it by tapping). Pinch-zoom/drag-pan is P-AC-11.
  const [hover, setHover] = useState<{ label: string; left: number; top: number } | null>(null);
  const hoverCell = useRef<string>('');
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedQuickLook, setSelectedQuickLook] = useState<string | null>(null);

  // The selected cell's quick-look (device-agnostic; refreshes after a placement via inspectorNonce).
  useEffect(() => {
    if (!selected) {
      setSelectedQuickLook(null);
      return;
    }
    let active = true;
    void fetchCurrentPixel(selected.x, selected.y).then((pixel) => {
      if (active) setSelectedQuickLook(quickLookLabel(pixel));
    });
    return () => {
      active = false;
    };
  }, [selected, inspectorNonce]);

  const onCanvasMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || !dims) return;
      const rect = canvas.getBoundingClientRect();
      const cell = cellFromPoint(rect, event.clientX, event.clientY, dims.width, dims.height);
      const key = cell ? `${cell.x},${cell.y}` : '';
      if (key === hoverCell.current) return; // only refetch/reposition when the cell changes
      hoverCell.current = key;
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
      setHover(null); // hide the previous cell's label at once — never show a stale one during the debounce
      if (!cell) return;
      // Position the tooltip in the (non-transformed) container, relative to its top-left.
      const crect = containerRef.current?.getBoundingClientRect();
      const left = crect ? event.clientX - crect.left : event.clientX - rect.left;
      const top = crect ? event.clientY - crect.top : event.clientY - rect.top;
      hoverTimer.current = setTimeout(() => {
        void fetchCurrentPixel(cell.x, cell.y).then((pixel) => {
          if (hoverCell.current === key) setHover({ label: quickLookLabel(pixel), left, top });
        });
      }, 120);
    },
    [dims],
  );

  const onCanvasLeave = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverCell.current = '';
    setHover(null);
  }, []);

  // --- Pan / zoom (P-AC-11). The canvas + selected highlight live in a transformed layer; the
  // screen↔cell mapping (cellFromPoint) still works because getBoundingClientRect reflects the
  // transform. Pointer events unify mouse + touch; two pointers pinch-zoom, one pointer drags. ---
  const containerPoint = useCallback((clientX: number, clientY: number): { x: number; y: number } => {
    const rect = containerRef.current?.getBoundingClientRect();
    return rect ? { x: clientX - rect.left, y: clientY - rect.top } : { x: clientX, y: clientY };
  }, []);

  // Re-clamp the offset (and pin scale ≥ fit) against the container's current size.
  const settle = useCallback((vp: Viewport): Viewport => {
    const el = containerRef.current;
    if (!el) return vp;
    const scale = clampScale(vp.scale, SCALE_MIN, SCALE_MAX);
    const { offsetX, offsetY } = clampPan(scale, vp.offsetX, vp.offsetY, el.clientWidth, el.clientHeight);
    return { scale, offsetX, offsetY };
  }, []);

  const resetView = useCallback(() => setViewport({ scale: SCALE_MIN, offsetX: 0, offsetY: 0 }), []);

  // Wheel zoom needs a non-passive listener so the page doesn't scroll.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      const anchor = containerPoint(e.clientX, e.clientY);
      setViewport((vp) => settle(zoomAt(vp, anchor.x, anchor.y, clampScale(vp.scale * (e.deltaY < 0 ? 1.1 : 1 / 1.1), SCALE_MIN, SCALE_MAX))));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [containerPoint, settle]);

  // Re-clamp the viewport when the container resizes (window resize / orientation change) — an old
  // panned offset can fall outside the new valid range.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setViewport((vp) => settle(vp)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [settle]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    try {
      containerRef.current?.setPointerCapture?.(e.pointerId);
    } catch {
      // a non-active / synthetic pointer can't be captured — harmless
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragMoved.current = false;
    dragStart.current = { x: e.clientX, y: e.clientY };
    if (pointers.current.size === 2) {
      multiTouched.current = true; // a pinch — the eventual pointer-up is never a tap
      const [a, b] = [...pointers.current.values()];
      if (a && b) pinchRef.current = Math.hypot(a.x - b.x, a.y - b.y);
    }
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const prev = pointers.current.get(e.pointerId);
      if (!prev) return; // not dragging — let the hover handler run
      const cur = { x: e.clientX, y: e.clientY };
      pointers.current.set(e.pointerId, cur);
      if (pointers.current.size >= 2) {
        const [a, b] = [...pointers.current.values()];
        if (!a || !b) return;
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const prevDist = pinchRef.current ?? dist;
        pinchRef.current = dist;
        const mid = containerPoint((a.x + b.x) / 2, (a.y + b.y) / 2);
        dragMoved.current = true;
        setViewport((vp) => settle(zoomAt(vp, mid.x, mid.y, pinchScale(vp.scale, dist, prevDist, SCALE_MIN, SCALE_MAX))));
        return;
      }
      // Cumulative distance from the press origin — a slow multi-step drag still counts as a drag, not a tap.
      const start = dragStart.current;
      if (start && Math.hypot(cur.x - start.x, cur.y - start.y) > 4) dragMoved.current = true;
      if (!dragMoved.current) return; // still within the tap dead-zone — don't pan on jitter
      setViewport((vp) => settle({ scale: vp.scale, offsetX: vp.offsetX + (cur.x - prev.x), offsetY: vp.offsetY + (cur.y - prev.y) }));
    },
    [containerPoint, settle],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const wasSingle = pointers.current.size === 1;
      pointers.current.delete(e.pointerId);
      if (pointers.current.size < 2) pinchRef.current = null;
      // A tap: the last pointer lifted, it never dragged, and no second pointer touched this gesture.
      if (wasSingle && !dragMoved.current && !multiTouched.current) selectAt(e.clientX, e.clientY);
      if (pointers.current.size === 0) multiTouched.current = false; // reset for the next gesture
    },
    [selectAt],
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
      <div
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ position: 'relative', overflow: 'hidden', touchAction: 'none', maxWidth: '100%' }}
      >
        <div
          style={{
            transform: `translate(${viewport.offsetX}px, ${viewport.offsetY}px) scale(${viewport.scale})`,
            transformOrigin: '0 0',
            position: 'relative',
          }}
        >
          <canvas
            ref={canvasRef}
            onMouseMove={onCanvasMove}
            onMouseLeave={onCanvasLeave}
            aria-label="Live canvas — tap a cell to place; drag to pan, pinch or scroll to zoom"
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
        {hover && (
          <div
            role="status"
            style={{
              position: 'absolute',
              left: hover.left,
              top: hover.top,
              transform: 'translate(8px, 8px)',
              pointerEvents: 'none',
              background: 'rgba(0,0,0,0.8)',
              color: '#fff',
              font: '12px sans-serif',
              padding: '2px 6px',
              borderRadius: 4,
              whiteSpace: 'nowrap',
              zIndex: 2,
            }}
          >
            {hover.label}
          </div>
        )}
      </div>
      {viewport.scale > SCALE_MIN && (
        <button type="button" onClick={resetView} style={{ marginTop: '0.25rem' }}>
          Reset view
        </button>
      )}

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

      {selected && selectedQuickLook && (
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
          ({selected.x}, {selected.y}): {selectedQuickLook}
        </p>
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
