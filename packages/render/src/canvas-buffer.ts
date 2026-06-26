// @quad/render — canvas model. Holds the authoritative cell colors a renderer draws from, applies
// the REST snapshot (initial paint / reconnect base) and live WS `PixelPlaced` deltas, and tracks
// which cells changed so the view redraws only dirty regions. Delta application is idempotent and
// reorder-safe via the per-canvas `seq` watermark — the primitive reconnect convergence relies on
// (ARCHITECTURE §11): a delta at or below the snapshot watermark is already reflected and ignored.
import type { dto, ws } from '@quad/core';

/** A cell with no placed pixel. */
export const EMPTY_CELL = -1;

export interface DirtyCell {
  readonly x: number;
  readonly y: number;
  readonly color: number;
}

export class CanvasBuffer {
  readonly width: number;
  readonly height: number;
  readonly #cells: Int32Array;
  readonly #dirty = new Set<number>();
  #seq = 0;
  #fullRepaint = false;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.#cells = new Int32Array(width * height).fill(EMPTY_CELL);
  }

  /** Highest per-canvas sequence reflected in this buffer (the resume watermark). */
  get seq(): number {
    return this.#seq;
  }

  #inBounds(x: number, y: number): boolean {
    return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  #index(x: number, y: number): number {
    return y * this.width + x;
  }

  /** Replace all state from a snapshot (initial paint or post-reconnect). Marks everything dirty. */
  loadSnapshot(snapshot: dto.CanvasSnapshotResponse): void {
    this.#cells.fill(EMPTY_CELL);
    for (const cell of snapshot.cells) {
      if (this.#inBounds(cell.x, cell.y)) {
        this.#cells[this.#index(cell.x, cell.y)] = cell.color;
      }
    }
    this.#seq = snapshot.seq;
    this.#dirty.clear();
    // Flag a full repaint instead of enqueuing every cell — cheap for large canvases.
    this.#fullRepaint = true;
  }

  /** Whether the next drain is a full repaint (after a snapshot load). */
  needsFullRepaint(): boolean {
    return this.#fullRepaint;
  }

  /**
   * Apply a live delta. Out-of-bounds and stale (`seq` ≤ watermark) deltas are ignored. Deltas with
   * no `seq` are always applied (best-effort). Returns whether the buffer changed.
   */
  applyDelta(delta: ws.PixelPlaced): boolean {
    if (delta.seq !== undefined && delta.seq <= this.#seq) return false;
    const { x, y } = delta.at;
    if (!this.#inBounds(x, y)) return false;
    const i = this.#index(x, y);
    this.#cells[i] = delta.color;
    this.#dirty.add(i);
    if (delta.seq !== undefined) this.#seq = delta.seq;
    return true;
  }

  /** Color index at a cell, or `EMPTY_CELL`. */
  colorAt(x: number, y: number): number {
    return this.#inBounds(x, y) ? (this.#cells[this.#index(x, y)] ?? EMPTY_CELL) : EMPTY_CELL;
  }

  /** Drain cells changed since the last drain — the renderer repaints only these (dirty regions). */
  drainDirty(): DirtyCell[] {
    const out: DirtyCell[] = [];
    const indices = this.#fullRepaint ? this.#cells.keys() : this.#dirty;
    for (const i of indices) {
      out.push({ x: i % this.width, y: Math.floor(i / this.width), color: this.#cells[i] ?? EMPTY_CELL });
    }
    this.#dirty.clear();
    this.#fullRepaint = false;
    return out;
  }
}
