// apps/web — paint a canvas snapshot onto a <canvas> (shared by the archive view + the replay player).
// Static render: loads the snapshot into a @quad/render buffer and fills each cell. Tenant palette is
// assumed 'default' (single tenant); carrying the palette in archive metadata is a follow-up.
import { CanvasBuffer, EMPTY_CELL } from '@quad/render';
import type { dto } from '@quad/core';
import { colorHex } from '@/canvas/inspector-client';

const EMPTY_HEX = '#F4F4F4';

/** A safe download filename for a term's final image (sanitizes the term; never empty). */
export function archiveImageFilename(term: string): string {
  const safe = term.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'term';
  return `quad-canvas-${safe}.png`;
}

export function paintSnapshot(
  canvas: HTMLCanvasElement,
  snapshot: dto.CanvasSnapshotResponse,
  palette: string,
  cellPx: number,
): void {
  const buffer = new CanvasBuffer(snapshot.width, snapshot.height);
  buffer.loadSnapshot(snapshot);
  canvas.width = snapshot.width * cellPx;
  canvas.height = snapshot.height * cellPx;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const cell of buffer.drainDirty()) {
    ctx.fillStyle = cell.color === EMPTY_CELL ? EMPTY_HEX : colorHex(palette, cell.color);
    ctx.fillRect(cell.x * cellPx, cell.y * cellPx, cellPx, cellPx);
  }
}
