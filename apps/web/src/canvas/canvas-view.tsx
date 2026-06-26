'use client';

// apps/web — live canvas view. Drives the framework-agnostic CanvasClient and paints the buffer's
// dirty regions to a <canvas>. View/read only — placement interaction is gated until auth (M20).
import { useEffect, useRef } from 'react';
import { getPaletteByKey } from '@quad/config';
import type { CanvasBuffer } from '@quad/render';
import { EMPTY_CELL } from '@quad/render';
import type { dto } from '@quad/core';
import { CanvasClient, type SocketLike } from './canvas-client';

// The API must be reached at the TENANT host so it resolves the tenant from the Host header.
// Default '' = same-origin (relative URLs) preserves the browser's tenant host. A cross-origin
// NEXT_PUBLIC_API_BASE only works if it forwards the tenant host (proxy/rewrite).
const API_BASE = process.env['NEXT_PUBLIC_API_BASE'] ?? '';
const CELL_PX = 8;
const EMPTY_HEX = '#F4F4F4';

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

  useEffect(() => {
    const wsBase = (API_BASE || window.location.origin).replace(/^http/, 'ws');
    const client = new CanvasClient({
      fetchMeta: async () => (await fetch(`${API_BASE}/api/v1/canvas/current`)).json() as Promise<dto.CanvasMetaResponse>,
      fetchSnapshot: async () =>
        (await fetch(`${API_BASE}/api/v1/canvas/current/snapshot`)).json() as Promise<dto.CanvasSnapshotResponse>,
      openSocket: () => new WebSocket(`${wsBase}/api/v1/canvas/current/ws`) as unknown as SocketLike,
      onUpdate: (buffer, ctx) => paint(canvasRef.current, buffer, ctx.palette),
    });
    void client.start();
    return () => {
      client.stop();
    };
  }, []);

  return <canvas ref={canvasRef} aria-label="Live canvas" style={{ imageRendering: 'pixelated', width: '100%' }} />;
}
