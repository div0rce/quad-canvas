'use client';

// apps/web — live canvas view + placement. Drives the framework-agnostic CanvasClient and paints the
// buffer's dirty regions to a <canvas>. Placement is a TWO-STEP confirm: click a cell to select it,
// then pick a color and Confirm — the write POSTs to the server (the authoritative path) with the
// session cookie and an idempotency key, and the result returns as a WS delta. Anonymous users get a
// clear "sign in" message (no anonymous writes). Server-authoritative: the UI never mutates locally.
import { useCallback, useEffect, useRef, useState } from 'react';
import { colorHexForValue, colorNameForValue, encodeCustomColor, getPaletteByKey } from '@quad/config';
import type { CanvasBuffer, Viewport } from '@quad/render';
import { EMPTY_CELL, zoomAt, clampScale } from '@quad/render';
import { CanvasClient, type SocketLike } from './canvas-client';
import { cellFromPoint, moveCell, placementIntentIsSettled, placementStatusMessage, type CellArrowKey } from './placement';
import { fetchCurrentPixel, quickLookLabel, type CurrentPixelResult } from './quick-look-client';
import { clampPan, pinchScale } from './gestures';
import {
  isCanvasMetaResponse,
  isCanvasSnapshotResponse,
  isPlacePixelResultResponse,
  isRecord,
} from '@/lib/api-response';
import { apiBase, apiPath, websocketApiBase } from '@/lib/api-base';

const SCALE_MIN = 1; // fit-to-width
const SCALE_MAX = 8;
import { formatCountdown, remainingMs } from './cooldown';
import { ReportControl } from './report-control';
import { PixelInspector } from './pixel-inspector';

const CELL_PX = 8;
const EMPTY_HEX = '#F4F4F4';
const DEFAULT_CUSTOM_HEX = '#1D70B8';
const MIXER_BASE_HEX = '#CC0033';
const HUE_STOPS = [
  { h: 0, name: 'Red' },
  { h: 30, name: 'Orange' },
  { h: 60, name: 'Yellow' },
  { h: 90, name: 'Lime' },
  { h: 120, name: 'Green' },
  { h: 150, name: 'Mint' },
  { h: 180, name: 'Cyan' },
  { h: 210, name: 'Sky' },
  { h: 240, name: 'Blue' },
  { h: 270, name: 'Violet' },
  { h: 300, name: 'Magenta' },
  { h: 330, name: 'Rose' },
] as const;
const MIXER_STEPS = [0.2, 0.35, 0.5, 0.65, 0.8] as const;
const RGB_CHANNELS = [
  { key: 'r', label: 'Red' },
  { key: 'g', label: 'Green' },
  { key: 'b', label: 'Blue' },
] as const;

type RgbChannel = (typeof RGB_CHANNELS)[number]['key'];

interface RgbColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

interface HsvColor {
  readonly h: number;
  readonly s: number;
  readonly v: number;
}

interface EyeDropperResult {
  readonly sRGBHex: string;
}

interface EyeDropperInstance {
  open: () => Promise<EyeDropperResult>;
}

declare global {
  interface Window {
    EyeDropper?: new () => EyeDropperInstance;
  }
}

interface Dims {
  readonly width: number;
  readonly height: number;
  readonly palette: string;
}

function colorByteToHex(value: number): string {
  return value.toString(16).padStart(2, '0').toUpperCase();
}

function colorByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function colorPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function colorHue(value: number): number {
  return ((Math.round(value) % 360) + 360) % 360;
}

function rgbToHex(color: RgbColor): string {
  return `#${colorByteToHex(color.r)}${colorByteToHex(color.g)}${colorByteToHex(color.b)}`;
}

function hexToRgb(hex: string): RgbColor {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff,
  };
}

function rgbToHsv(color: RgbColor): HsvColor {
  const r = color.r / 255;
  const g = color.g / 255;
  const b = color.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const h =
    delta === 0
      ? 0
      : max === r
        ? 60 * (((g - b) / delta) % 6)
        : max === g
          ? 60 * ((b - r) / delta + 2)
          : 60 * ((r - g) / delta + 4);
  return {
    h: colorHue(h),
    s: max === 0 ? 0 : colorPercent((delta / max) * 100),
    v: colorPercent(max * 100),
  };
}

function hsvToRgb(color: HsvColor): RgbColor {
  const h = colorHue(color.h);
  const s = color.s / 100;
  const v = color.v / 100;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return {
    r: colorByte((r + m) * 255),
    g: colorByte((g + m) * 255),
    b: colorByte((b + m) * 255),
  };
}

function hsvToHex(color: HsvColor): string {
  return rgbToHex(hsvToRgb(color));
}

function hexToHsv(hex: string): HsvColor {
  return rgbToHsv(hexToRgb(hex));
}

function mixHex(a: string, b: string, weight: number): string {
  const left = hexToRgb(a);
  const right = hexToRgb(b);
  return rgbToHex({
    r: left.r * (1 - weight) + right.r * weight,
    g: left.g * (1 - weight) + right.g * weight,
    b: left.b * (1 - weight) + right.b * weight,
  });
}

function paint(canvas: HTMLCanvasElement | null, buffer: CanvasBuffer, paletteKey: string): void {
  if (!canvas) return;
  if (canvas.width !== buffer.width * CELL_PX) canvas.width = buffer.width * CELL_PX;
  if (canvas.height !== buffer.height * CELL_PX) canvas.height = buffer.height * CELL_PX;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  for (const cell of buffer.drainDirty()) {
    const hex = cell.color === EMPTY_CELL ? EMPTY_HEX : colorHexForValue(paletteKey, cell.color, EMPTY_HEX);
    ctx.fillStyle = hex;
    ctx.fillRect(cell.x * CELL_PX, cell.y * CELL_PX, CELL_PX, CELL_PX);
  }
}

function currentPixelLabel(result: CurrentPixelResult, paletteKey: string): string {
  const colorName = result.kind === 'pixel' ? colorNameForValue(paletteKey, result.pixel.color) : undefined;
  return quickLookLabel(result, colorName);
}

export function CanvasView(): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const placementDialogRef = useRef<HTMLDivElement>(null);
  const customColorNativeRef = useRef<HTMLInputElement>(null);
  const clientRef = useRef<CanvasClient | null>(null);
  const placementIntentRef = useRef<{ fingerprint: string; key: string } | null>(null);
  // Pan/zoom (P-AC-11) — declared up here so the click/hover handlers below can read them.
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<Viewport>({ scale: SCALE_MIN, offsetX: 0, offsetY: 0 });
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<number | null>(null);
  const dragMoved = useRef(false);
  const dragStart = useRef<{ x: number; y: number } | null>(null); // pointer-down origin (cumulative-distance tap test)
  const multiTouched = useRef(false); // a second pointer touched during this gesture → not a tap
  const [dims, setDims] = useState<Dims | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [selected, setSelected] = useState<{ x: number; y: number } | null>(null);
  const [keyboardCell, setKeyboardCell] = useState<{ x: number; y: number } | null>(null);
  const [keyboardQuickLook, setKeyboardQuickLook] = useState<{ key: string; label: string } | null>(null);
  const [pendingColor, setPendingColor] = useState<number | null>(null);
  const [customEditorOpen, setCustomEditorOpen] = useState(false);
  const [customDraftHsv, setCustomDraftHsv] = useState<HsvColor>(() => hexToHsv(DEFAULT_CUSTOM_HEX));
  const [savedCustomHex, setSavedCustomHex] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [inspectorNonce, setInspectorNonce] = useState(0); // bumps to refetch the inspector after a placement
  const [cooldownUntil, setCooldownUntil] = useState(0); // epoch ms the cooldown ends (display only)
  const [nowTick, setNowTick] = useState(0); // latest clock sample; updated outside render only

  // Tick once a second while a cooldown is pending so the countdown updates (server still enforces).
  useEffect(() => {
    if (cooldownUntil === 0) return;
    const id = setInterval(() => {
      const now = Date.now();
      setNowTick(now);
      if (now >= cooldownUntil) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [cooldownUntil]);

  const cooldownRemainingMs = remainingMs(cooldownUntil, nowTick);
  const startCooldown = useCallback((durationMs: number) => {
    const now = Date.now();
    setNowTick(now);
    setCooldownUntil(now + durationMs);
  }, []);

  useEffect(() => {
    const base = apiBase();
    const wsBase = (websocketApiBase() || window.location.origin).replace(/^http/, 'ws');
    const client = new CanvasClient({
      fetchMeta: async () => {
        const res = await fetch(`${base}/api/v1/canvas/current`);
        if (!res.ok) throw new Error(`canvas metadata request failed (${res.status})`);
        const meta = (await res.json()) as unknown;
        if (!isCanvasMetaResponse(meta)) throw new Error('canvas metadata response was malformed');
        setDims({ width: meta.width, height: meta.height, palette: meta.palette });
        return meta;
      },
      fetchSnapshot: async () => {
        const res = await fetch(`${base}/api/v1/canvas/current/snapshot`);
        if (!res.ok) throw new Error(`canvas snapshot request failed (${res.status})`);
        const snapshot = (await res.json()) as unknown;
        if (!isCanvasSnapshotResponse(snapshot)) throw new Error('canvas snapshot response was malformed');
        return snapshot;
      },
      openSocket: () => new WebSocket(`${wsBase}/api/v1/canvas/current/ws`) as unknown as SocketLike,
      onUpdate: (buffer, ctx) => {
        paint(canvasRef.current, buffer, ctx.palette);
        setLoadState('ready');
      },
    });
    clientRef.current = client;
    // Surface a load failure instead of leaving a blank canvas, and never let the initial load reject
    // unhandled (a down/erroring API would otherwise be a silent blank screen + an unhandled rejection).
    client.start().catch(() => setLoadState('error'));
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
      if (!canvas || !dims || loadState !== 'ready' || submitting) return; // ignore until loaded / while placing
      const cell = cellFromPoint(canvas.getBoundingClientRect(), clientX, clientY, dims.width, dims.height);
      if (cell) {
        setKeyboardCell(cell);
        setSelected(cell); // step 1 — select the cell
        setPendingColor(null);
        setStatus('');
      }
    },
    [dims, loadState, submitting],
  );

  // Quick-look: the current cell's owner + time, lighter than the click-to-open history. On desktop it
  // follows the pointer (hover); on every device a selected cell shows the same quick-look line (so touch
  // users — who can't hover — get it by tapping). Pinch-zoom/drag-pan is P-AC-11.
  const [hover, setHover] = useState<{ label: string; left: number; top: number } | null>(null);
  const hoverCell = useRef<string>('');
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedQuickLook, setSelectedQuickLook] = useState<{ key: string; label: string } | null>(null);
  const selectedKey = selected ? `${selected.x},${selected.y}` : null;

  // The confirmation controls are a fixed bottom sheet so selecting a cell never puts the deliberate
  // second step below a tall/zoomed canvas. Move focus without scrolling the canvas out from under the
  // user; Escape and Cancel restore focus to the keyboard-operable canvas surface.
  useEffect(() => {
    if (selected) placementDialogRef.current?.focus({ preventScroll: true });
  }, [selected]);

  // The selected cell's quick-look (device-agnostic; refreshes after a placement via inspectorNonce).
  useEffect(() => {
    if (!selected) return;
    const key = `${selected.x},${selected.y}`;
    let active = true;
    void fetchCurrentPixel(selected.x, selected.y).then((result) => {
      if (active) {
        const next = { key, label: currentPixelLabel(result, dims?.palette ?? 'default') };
        setSelectedQuickLook(next);
        setKeyboardQuickLook(next);
      }
    });
    return () => {
      active = false;
    };
  }, [selected, inspectorNonce, dims?.palette]);

  // Keyboard focus has the same coordinate/color/owner/time parallel as pointer quick-look, without
  // opening the placement sheet until Enter/Space is pressed.
  useEffect(() => {
    if (!keyboardCell || selected || loadState !== 'ready') return;
    const key = `${keyboardCell.x},${keyboardCell.y}`;
    if (keyboardQuickLook?.key === key) return;
    let active = true;
    void fetchCurrentPixel(keyboardCell.x, keyboardCell.y).then((result) => {
      if (active) setKeyboardQuickLook({ key, label: currentPixelLabel(result, dims?.palette ?? 'default') });
    });
    return () => {
      active = false;
    };
  }, [keyboardCell, keyboardQuickLook?.key, selected, loadState, inspectorNonce, dims?.palette]);

  const onCanvasMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || !dims || selected) return; // selected-cell quick-look owns the same information
      if (pointers.current.size > 0) return; // an active pan/pinch is not a hover-inspection intent
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
        void fetchCurrentPixel(cell.x, cell.y).then((result) => {
          if (hoverCell.current === key) {
            setHover({ label: `(${cell.x}, ${cell.y}): ${currentPixelLabel(result, dims.palette)}`, left, top });
          }
        });
      }, 120);
    },
    [dims, selected],
  );

  const onCanvasLeave = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverCell.current = '';
    setHover(null);
  }, []);

  // Pointer-up can queue a mousemove before React commits the selection. Cancel that pending hover
  // lookup once the selected-cell quick-look becomes the single owner of the same information.
  useEffect(() => {
    if (!selected) return;
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    hoverCell.current = '';
  }, [selected]);

  // Cancel a pending quick-look debounce on unmount (no setState-after-unmount / timer leak).
  useEffect(() => () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
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

  // Zoom to an absolute scale, anchored at the stage center — backs the discrete 1x/2x/4x HUD
  // buttons while staying inside the same continuous, clamped zoom model (no separate state).
  const zoomTo = useCallback(
    (target: number) => {
      const el = containerRef.current;
      const next = clampScale(target, SCALE_MIN, SCALE_MAX);
      if (!el) {
        setViewport((vp) => settle({ scale: next, offsetX: vp.offsetX, offsetY: vp.offsetY }));
        return;
      }
      setViewport((vp) => settle(zoomAt(vp, el.clientWidth / 2, el.clientHeight / 2, next)));
    },
    [settle],
  );

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
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverCell.current = '';
    setHover(null);
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

  // Pointer CANCEL (the OS/browser aborted the gesture, e.g. a scroll/zoom takeover). Same state
  // cleanup as onPointerUp but WITHOUT selectAt — a canceled gesture is not a tap, so it must not
  // place a selection. (Reusing onPointerUp here would register a spurious cell selection; dropping
  // the handler entirely would leak the pointer and wedge the next gesture.)
  const onPointerCancel = useCallback((e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchRef.current = null;
    if (pointers.current.size === 0) multiTouched.current = false;
  }, []);

  const onCanvasFocus = useCallback(() => {
    if (pointers.current.size > 0) return; // pointer selection initializes the actual clicked cell on pointer-up
    if (dims && loadState === 'ready') setKeyboardCell((cell) => cell ?? selected ?? { x: 0, y: 0 });
  }, [dims, loadState, selected]);

  const onCanvasKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLCanvasElement>) => {
      if (!dims || loadState !== 'ready' || submitting) return;
      const cell = keyboardCell ?? selected ?? { x: 0, y: 0 };
      const arrows: readonly CellArrowKey[] = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      if (arrows.includes(event.key as CellArrowKey)) {
        event.preventDefault();
        setKeyboardCell(moveCell(cell, event.key as CellArrowKey, dims.width, dims.height));
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setKeyboardCell(cell);
        setSelected(cell);
        setPendingColor(null);
        setStatus('');
      }
    },
    [dims, keyboardCell, loadState, selected, submitting],
  );

  const selectPaletteColor = useCallback((color: number) => {
    setPendingColor(color);
  }, []);

  const setCustomChannel = useCallback((channel: RgbChannel, value: number) => {
    setCustomDraftHsv((hsv) => rgbToHsv({ ...hsvToRgb(hsv), [channel]: colorByte(value) }));
  }, []);

  const setCustomHue = useCallback((hue: number) => {
    setCustomDraftHsv((hsv) => ({ ...hsv, h: colorHue(hue), s: Math.max(hsv.s, 12), v: Math.max(hsv.v, 18) }));
  }, []);

  const setCustomSaturationValue = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
    setCustomDraftHsv((hsv) => ({
      ...hsv,
      s: colorPercent((x / rect.width) * 100),
      v: colorPercent(100 - (y / rect.height) * 100),
    }));
  }, []);

  const onCustomSvPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setCustomSaturationValue(event);
    },
    [setCustomSaturationValue],
  );

  const onCustomSvPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.buttons !== 1) return;
      event.preventDefault();
      setCustomSaturationValue(event);
    },
    [setCustomSaturationValue],
  );

  const chooseCustomDraft = useCallback((hex: string) => {
    setCustomDraftHsv(hexToHsv(hex));
  }, []);

  const pickScreenColor = useCallback(async () => {
    const EyeDropper = window.EyeDropper;
    if (EyeDropper) {
      try {
        const result = await new EyeDropper().open();
        chooseCustomDraft(result.sRGBHex.toUpperCase());
      } catch {
        // The user can cancel the eyedropper; leave the existing selection unchanged.
      }
      return;
    }
    customColorNativeRef.current?.click();
  }, [chooseCustomDraft]);

  const saveCustomColor = useCallback(() => {
    const customDraftHex = hsvToHex(customDraftHsv);
    const encoded = encodeCustomColor(customDraftHex);
    if (encoded === null) return;
    setSavedCustomHex(customDraftHex);
    setPendingColor(encoded);
    setCustomEditorOpen(false);
  }, [customDraftHsv]);

  const confirm = useCallback(async () => {
    if (!selected || pendingColor === null || submitting) return; // single in-flight placement only
    setSubmitting(true);
    setStatus('Placing…');
    const fingerprint = JSON.stringify([selected.x, selected.y, pendingColor]);
    const placementCanvasId = clientRef.current?.canvasId ?? null;
    const priorIntent = placementIntentRef.current;
    const idempotencyKey = priorIntent?.fingerprint === fingerprint ? priorIntent.key : crypto.randomUUID();
    placementIntentRef.current = { fingerprint, key: idempotencyKey };
    try {
      const res = await fetch(apiPath('/api/v1/canvas/current/pixels'), {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey },
        credentials: 'include', // send the session cookie; anonymous → 401
        body: JSON.stringify({ at: selected, color: pendingColor }),
      });
      if (res.status === 201) {
        // Feed the REST result through the controller's normal sequence/gap guard. It may apply the
        // next contiguous event immediately; if another user's lower sequence is missing, it will
        // resnapshot instead of painting stale state or advancing past the gap.
        const body = (await res.json().catch(() => null)) as unknown;
        const validResult = isPlacePixelResultResponse(body);
        if (placementIntentIsSettled(res.status, validResult)) placementIntentRef.current = null;
        if (!validResult) {
          setStatus('The server returned an invalid placement response. Try again.');
          return;
        }
        clientRef.current?.applyConfirmedPlacement(body, placementCanvasId);
        if (body.cooldownMs > 0) startCooldown(body.cooldownMs); // display the countdown
        setStatus(placementStatusMessage(201));
        setPendingColor(null);
        setInspectorNonce((n) => n + 1); // keep the cell selected; refresh its history to show the placement
      } else {
        if (placementIntentIsSettled(res.status, false)) placementIntentRef.current = null;
        const body = (await res.json().catch(() => null)) as unknown;
        const error = isRecord(body) && isRecord(body['error']) ? body['error'] : null;
        const details = error && isRecord(error['details']) ? error['details'] : null;
        // The server is on cooldown — reflect its retry-after as the countdown.
        const retryAfterMs = details?.['retryAfterMs'];
        if (typeof retryAfterMs === 'number' && retryAfterMs > 0) startCooldown(retryAfterMs);
        const code = typeof error?.['code'] === 'string' ? error['code'] : undefined;
        const message = typeof error?.['message'] === 'string' ? error['message'] : undefined;
        setStatus(placementStatusMessage(res.status, code, message));
      }
    } catch {
      setStatus('Network error — could not reach the server.');
    } finally {
      setSubmitting(false);
    }
  }, [selected, pendingColor, submitting, startCooldown]);

  const cancel = useCallback(() => {
    setSelected(null);
    setPendingColor(null);
    setStatus('');
    canvasRef.current?.focus({ preventScroll: true });
  }, []);

  const palette = dims ? getPaletteByKey(dims.palette) : null;
  const customDraftHex = hsvToHex(customDraftHsv);
  const customDraftRgb = hsvToRgb(customDraftHsv);
  const savedCustomColorValue = savedCustomHex ? encodeCustomColor(savedCustomHex) : null;
  const mixerBaseHex =
    pendingColor !== null && dims ? colorHexForValue(dims.palette, pendingColor, MIXER_BASE_HEX) : savedCustomHex ?? MIXER_BASE_HEX;
  const mixerColors = MIXER_STEPS.map((step) => mixHex(mixerBaseHex, customDraftHex, step));
  const confirmReady = pendingColor !== null && !submitting && cooldownRemainingMs === 0;
  const confirmLabel = submitting
    ? 'Placing…'
    : cooldownRemainingMs > 0
      ? `Wait ${formatCountdown(cooldownRemainingMs)}`
      : pendingColor === null
        ? 'Pick a color'
        : 'Confirm';
  const placeHint =
    cooldownRemainingMs > 0
      ? 'Your cooldown is running — the same for everyone.'
      : 'Placement is a deliberate two step, so a stray tap never wastes your cooldown.';
  const cdBig = cooldownRemainingMs > 0 ? formatCountdown(cooldownRemainingMs) : loadState === 'error' ? 'Offline' : 'Ready';
  const statusLine = (
    <p role="status" aria-live="polite" style={{ minHeight: '1.2em', margin: 0, fontSize: 18, color: 'var(--ink-soft)' }}>
      {status}
    </p>
  );

  return (
    <div className="quad-canvas-main">
      <div className="quad-canvas-body">
        <div className="quad-canvas-col">
          <div
            ref={containerRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            className="quad-canvas-stage"
            style={{ touchAction: 'none', cursor: loadState === 'ready' ? 'grab' : 'default', borderWidth: 0 }}
          >
            <div
              style={{
                transform: `translate(${viewport.offsetX}px, ${viewport.offsetY}px) scale(${viewport.scale})`,
                transformOrigin: '0 0',
                position: 'relative',
                width: '100%',
                height: '100%',
              }}
            >
              <canvas
                ref={canvasRef}
                tabIndex={0}
                onMouseMove={onCanvasMove}
                onMouseLeave={onCanvasLeave}
                onFocus={onCanvasFocus}
                onKeyDown={onCanvasKeyDown}
                aria-busy={loadState === 'loading'}
                aria-label="Live canvas — focus the canvas to navigate cells with the arrow keys, then press Enter to choose a color; tap a cell to place; drag to pan, pinch or scroll to zoom"
                className="quad-canvas"
                style={{ width: '100%', height: '100%', display: 'block', cursor: dims && loadState === 'ready' ? 'crosshair' : 'default' }}
              />
              {selected && dims && (
                <div
                  aria-hidden
                  className="quad-marquee"
                  style={{
                    left: `${(selected.x / dims.width) * 100}%`,
                    top: `${(selected.y / dims.height) * 100}%`,
                    width: `${100 / dims.width}%`,
                    height: `${100 / dims.height}%`,
                  }}
                />
              )}
              {!selected && keyboardCell && dims && (
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: `${(keyboardCell.x / dims.width) * 100}%`,
                    top: `${(keyboardCell.y / dims.height) * 100}%`,
                    width: `${100 / dims.width}%`,
                    height: `${100 / dims.height}%`,
                    outline: '2px dashed var(--qa)',
                    outlineOffset: '-1px',
                    boxSizing: 'border-box',
                    pointerEvents: 'none',
                  }}
                />
              )}
            </div>

            <div className="quad-hud" style={{ top: 12, left: 12, pointerEvents: 'none' }}>
              <span className="quad-dot quad-blink" style={{ background: loadState === 'ready' ? 'var(--live-red)' : 'var(--status-orange)' }} />
              <span>{loadState === 'ready' ? 'LIVE' : loadState === 'error' ? 'OFFLINE' : 'LOADING'}</span>
            </div>
            <div
              className="quad-hud quad-hud--ink quad-pixel"
              style={{ bottom: 12, left: 12, pointerEvents: 'none', fontSize: 15 }}
            >
              {selected ? `(${selected.x}, ${selected.y})` : keyboardCell ? `(${keyboardCell.x}, ${keyboardCell.y})` : '(--, --)'}
            </div>
            <div
              style={{ position: 'absolute', bottom: 12, right: 12, display: 'flex', gap: 6 }}
              onPointerDown={(event) => event.stopPropagation()}
              onPointerUp={(event) => event.stopPropagation()}
            >
              {[1, 2, 4].map((z) => (
                <button
                  key={z}
                  type="button"
                  className="quad-hud-btn"
                  aria-label={`Zoom ${z}x`}
                  aria-pressed={z === 1 ? viewport.scale <= SCALE_MIN + 0.001 : Math.abs(viewport.scale - z) < 0.05}
                  onPointerDown={(event) => event.stopPropagation()}
                  onPointerUp={(event) => event.stopPropagation()}
                  onClick={() => (z === 1 ? resetView() : zoomTo(z))}
                >
                  {z}x
                </button>
              ))}
            </div>

            {loadState !== 'ready' && (
              <div
                role={loadState === 'error' ? 'alert' : 'status'}
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'grid',
                  placeItems: 'center',
                  padding: '1rem',
                  color: 'var(--ink)',
                  background: 'rgba(244, 244, 244, 0.92)',
                  textAlign: 'center',
                  fontSize: 20,
                  zIndex: 2,
                }}
              >
                {loadState === 'error' ? 'Could not load the canvas. Please refresh to retry.' : 'Loading canvas…'}
              </div>
            )}

            {hover && (
              <div
                role="status"
                className="quad-tooltip"
                style={{ left: hover.left, top: hover.top, transform: 'translate(12px, 12px)' }}
              >
                <div style={{ fontSize: 18, color: 'var(--ink-soft)' }}>{hover.label}</div>
              </div>
            )}
          </div>
        </div>

        <div className="quad-canvas-rail">
          {selected ? (
            <div
              ref={placementDialogRef}
              role="dialog"
              aria-label="Place a pixel"
              tabIndex={-1}
              onKeyDown={(event) => {
                if (event.key === 'Escape' && !submitting) cancel();
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="quad-eyebrow" style={{ fontSize: 18 }}>
                    Place a pixel
                  </span>
                  <span className="quad-pixel" style={{ fontSize: 14, color: 'var(--ink)' }}>
                    ({selected.x}, {selected.y})
                  </span>
                </div>
                <div
                  role="group"
                  aria-label="Choose a color"
                  style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 6, marginTop: 14 }}
                >
                  {palette?.colors.map((c) => (
                    <button
                      key={c.index}
                      type="button"
                      data-palette-color
                      aria-label={c.name}
                      aria-pressed={pendingColor === c.index}
                      disabled={submitting}
                      onClick={() => selectPaletteColor(c.index)}
                      className={pendingColor === c.index ? 'quad-swatch quad-swatch--selected' : 'quad-swatch'}
                      style={{ background: c.hex }}
                    />
                  ))}
                  <button
                    type="button"
                    aria-label="Custom color editor"
                    aria-expanded={customEditorOpen}
                    aria-controls="quad-custom-color-editor"
                    title="Custom color editor"
                    disabled={submitting}
                    onClick={() => setCustomEditorOpen((open) => !open)}
                    className={customEditorOpen ? 'quad-swatch quad-swatch--custom-toggle quad-swatch--selected' : 'quad-swatch quad-swatch--custom-toggle'}
                  >
                    <span aria-hidden="true" className="quad-custom-plus" />
                  </button>
                  {savedCustomColorValue !== null && savedCustomHex && (
                    <button
                      type="button"
                      data-custom-color-swatch
                      aria-label={`Use saved custom color ${savedCustomHex}`}
                      aria-pressed={pendingColor === savedCustomColorValue}
                      disabled={submitting}
                      onClick={() => selectPaletteColor(savedCustomColorValue)}
                      className={pendingColor === savedCustomColorValue ? 'quad-swatch quad-swatch--selected' : 'quad-swatch'}
                      style={{ background: savedCustomHex }}
                    />
                  )}
                </div>
                {customEditorOpen && (
                  <div id="quad-custom-color-editor" className="quad-custom-editor">
                    <input
                      ref={customColorNativeRef}
                      type="color"
                      tabIndex={-1}
                      aria-hidden="true"
                      value={customDraftHex}
                      onChange={(event) => chooseCustomDraft(event.currentTarget.value.toUpperCase())}
                      className="quad-color-native"
                    />
                    <div className="quad-custom-editor__top">
                      <button
                        type="button"
                        className="quad-custom-preview"
                        data-custom-preview-color={customDraftHex}
                        style={{ '--custom-color': customDraftHex } as React.CSSProperties}
                        onClick={() => customColorNativeRef.current?.click()}
                        aria-label="Open browser color picker"
                      />
                      <button type="button" className="quad-eyedropper-btn" onClick={() => void pickScreenColor()} disabled={submitting}>
                        <span aria-hidden="true" className="quad-eyedropper-icon" />
                        <span>Eyedrop</span>
                      </button>
                    </div>
                    <div className="quad-custom-tools">
                      <div className="quad-hue-wheel" aria-label="Hue wheel">
                        <span aria-hidden="true" className="quad-hue-wheel__ring" />
                        {HUE_STOPS.map((stop) => {
                          const radians = ((stop.h - 90) * Math.PI) / 180;
                          const hueHex = hsvToHex({ h: stop.h, s: 100, v: 100 });
                          return (
                            <button
                              key={stop.h}
                              type="button"
                              data-hue-stop
                              className={Math.abs(customDraftHsv.h - stop.h) < 8 ? 'quad-hue-stop quad-hue-stop--selected' : 'quad-hue-stop'}
                              style={
                                {
                                  '--hue-color': hueHex,
                                  left: `${50 + Math.cos(radians) * 39}%`,
                                  top: `${50 + Math.sin(radians) * 39}%`,
                                } as React.CSSProperties
                              }
                              aria-label={`Hue ${stop.name}`}
                              aria-pressed={Math.abs(customDraftHsv.h - stop.h) < 8}
                              onClick={() => setCustomHue(stop.h)}
                            />
                          );
                        })}
                        <button
                          type="button"
                          className="quad-hue-current"
                          style={{ '--custom-color': customDraftHex } as React.CSSProperties}
                          onClick={() => customColorNativeRef.current?.click()}
                          aria-label="Open browser color picker"
                        />
                      </div>
                      <div
                        className="quad-sv-square"
                        aria-label="Saturation and brightness"
                        onPointerDown={onCustomSvPointerDown}
                        onPointerMove={onCustomSvPointerMove}
                        style={
                          {
                            '--sv-hue': hsvToHex({ h: customDraftHsv.h, s: 100, v: 100 }),
                            '--sv-x': `${customDraftHsv.s}%`,
                            '--sv-y': `${100 - customDraftHsv.v}%`,
                          } as React.CSSProperties
                        }
                      >
                        <span aria-hidden="true" className="quad-sv-thumb" />
                      </div>
                    </div>
                    <div className="quad-custom-sliders">
                      {RGB_CHANNELS.map((channel) => (
                        <label key={channel.key} className="quad-color-slider">
                          <span>
                            {channel.label} <i>{customDraftRgb[channel.key]}</i>
                          </span>
                          <input
                            id={`quad-custom-color-${channel.key}`}
                            type="range"
                            min="0"
                            max="255"
                            value={customDraftRgb[channel.key]}
                            onChange={(event) => setCustomChannel(channel.key, Number(event.currentTarget.value))}
                            aria-label={`${channel.label} channel`}
                          />
                        </label>
                      ))}
                    </div>
                    <div className="quad-mixer" aria-label="Palette mixer">
                      <div className="quad-mixer__label">
                        <span>Palette mixer</span>
                        <span>blend with selected color</span>
                      </div>
                      <div className="quad-mixer__row">
                        {mixerColors.map((hex) => {
                          const normalizedMixerHex = hsvToHex(hexToHsv(hex));
                          const selectedMixerColor = customDraftHex === normalizedMixerHex;
                          return (
                            <button
                              key={hex}
                              type="button"
                              data-mixer-color
                              className={selectedMixerColor ? 'quad-mixer-color quad-mixer-color--selected' : 'quad-mixer-color'}
                              style={{ background: hex }}
                              aria-label={`Mixer color ${hex}`}
                              aria-pressed={selectedMixerColor}
                              onClick={() => chooseCustomDraft(hex)}
                            />
                          );
                        })}
                      </div>
                    </div>
                    <button type="button" className="quad-btn quad-btn--primary" onClick={saveCustomColor} disabled={submitting}>
                      Save custom color
                    </button>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button
                    type="button"
                    onClick={() => void confirm()}
                    disabled={pendingColor === null || submitting || cooldownRemainingMs > 0}
                    className={confirmReady ? 'quad-btn quad-btn--primary' : 'quad-btn'}
                    style={{ flex: 1 }}
                  >
                    {confirmLabel}
                  </button>
                  <button type="button" onClick={cancel} disabled={submitting} className="quad-btn">
                    Cancel
                  </button>
                </div>
                <p style={{ fontSize: 18, color: 'var(--muted-tag)', margin: '12px 0 0', lineHeight: 1.45 }}>{placeHint}</p>
                <div style={{ marginTop: 12 }}>
                  <ReportControl key={`${selected.x},${selected.y}`} x={selected.x} y={selected.y} />
                </div>
              </div>

              <div style={{ borderTop: '2px solid var(--hairline-2)', paddingTop: 18 }}>
                <span className="quad-eyebrow" style={{ fontSize: 18 }}>
                  Pixel story
                </span>
                {selectedQuickLook?.key === selectedKey && (
                  <p style={{ fontSize: 18, color: 'var(--ink-soft)', margin: '10px 0 0' }}>{selectedQuickLook.label}</p>
                )}
                {dims && (
                  <div style={{ marginTop: 12 }}>
                    <PixelInspector
                      key={`${selected.x},${selected.y}:${inspectorNonce}`}
                      x={selected.x}
                      y={selected.y}
                      palette={dims.palette}
                    />
                  </div>
                )}
              </div>

              {statusLine}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div className="quad-card quad-card--sm" style={{ background: 'var(--qa-tint2)', padding: 16 }}>
                <div className="quad-eyebrow" style={{ fontSize: 16 }}>
                  Your next pixel
                </div>
                <div className="quad-pixel" style={{ fontSize: 26, color: 'var(--ink)', marginTop: 10 }}>
                  {cdBig}
                </div>
                <p style={{ fontSize: 18, color: 'var(--ink-strong)', margin: '12px 0 0', lineHeight: 1.45 }}>
                  One pixel at a time. The cooldown is the same for everyone on campus.
                </p>
              </div>
              <div style={{ textAlign: 'center', padding: '10px 8px' }}>
                <div style={{ fontSize: 20, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Tap any cell to place
                </div>
                <p style={{ fontSize: 18, color: 'var(--muted-tag)', margin: '4px 0 0', lineHeight: 1.45 }}>
                  Pick a color, confirm, and your pixel appears for everyone at once.
                </p>
              </div>
              {statusLine}
            </div>
          )}
        </div>
      </div>

      <div className="quad-canvas-footer">
        <span>{dims ? `Canvas ${dims.width} x ${dims.height}` : loadState === 'error' ? 'Canvas unavailable' : 'Canvas loading…'}</span>
        <span>Zoom {viewport.scale.toFixed(1)}× / pan to explore</span>
      </div>
    </div>
  );
}
