// apps/web — canvas controller. Framework-agnostic orchestration of the live view: open the
// WebSocket and subscribe FIRST (queuing deltas), then fetch the REST snapshot, load a @quad/render
// CanvasBuffer, and flush the queued deltas — so no delta is lost in the gap between snapshot and
// subscription (the buffer's seq watermark drops any that the snapshot already covers). On an
// unexpected disconnect it reconnects, re-fetches the snapshot (fresh watermark), resubscribes, and
// resumes — convergent by construction (ARCHITECTURE §11). Network + socket are injected so this is
// unit-testable in Node. Read/view only — placement is gated (M20).
import { CanvasBuffer } from '@quad/render';
import type { dto, ws } from '@quad/core';

/** The minimal WebSocket surface the controller drives (the browser `WebSocket` satisfies it). */
export interface SocketLike {
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
  onerror: ((event: unknown) => void) | null;
}

export interface CanvasUpdateContext {
  /** The tenant's palette key — the view resolves colors from it. */
  readonly palette: string;
}

export interface CanvasClientOptions {
  readonly fetchMeta: () => Promise<dto.CanvasMetaResponse>;
  readonly fetchSnapshot: () => Promise<dto.CanvasSnapshotResponse>;
  readonly openSocket: () => SocketLike;
  /** Called after the snapshot loads and after each applied delta — repaint from the buffer. */
  readonly onUpdate: (buffer: CanvasBuffer, context: CanvasUpdateContext) => void;
  /** Backoff before a reconnect attempt (ms). Default 1000. */
  readonly reconnectDelayMs?: number;
  /** Scheduler for the reconnect backoff (injectable for tests). Default `setTimeout`. */
  readonly schedule?: (fn: () => void, ms: number) => void;
}

export class CanvasClient {
  readonly #opts: CanvasClientOptions;
  #buffer: CanvasBuffer | null = null;
  #socket: SocketLike | null = null;
  #canvasId: string | null = null;
  #palette = 'default';
  #snapshotLoaded = false;
  #pending: Array<ws.PixelPlaced | ws.PixelRolledBack> = [];
  #stopped = false;

  constructor(options: CanvasClientOptions) {
    this.#opts = options;
  }

  get buffer(): CanvasBuffer | null {
    return this.#buffer;
  }

  /** Subscribe, then load the snapshot and flush queued deltas (no gap). */
  async start(): Promise<void> {
    const meta = await this.#opts.fetchMeta();
    this.#canvasId = meta.id;
    this.#palette = meta.palette;
    this.#buffer = new CanvasBuffer(meta.width, meta.height);
    if (this.#stopped) return;
    this.#connect();
    await this.#loadSnapshotAndFlush();
  }

  #connect(): void {
    const socket = this.#opts.openSocket();
    this.#socket = socket;
    socket.onopen = () => {
      if (this.#canvasId !== null) {
        socket.send(JSON.stringify({ type: 'SubscribeCanvas', canvasId: this.#canvasId }));
      }
    };
    socket.onmessage = (event) => {
      this.#onMessage(event.data);
    };
    socket.onclose = () => {
      this.#onClose();
    };
  }

  #onClose(): void {
    this.#socket = null;
    if (this.#stopped) return;
    // Queue deltas until we have re-synced against a fresh snapshot.
    this.#snapshotLoaded = false;
    const delay = this.#opts.reconnectDelayMs ?? 1000;
    const schedule = this.#opts.schedule ?? ((fn, ms) => setTimeout(fn, ms));
    schedule(() => {
      void this.#reconnect();
    }, delay);
  }

  async #reconnect(): Promise<void> {
    if (this.#stopped || !this.#buffer) return;
    this.#connect();
    try {
      await this.#loadSnapshotAndFlush();
    } catch {
      this.#scheduleResync(); // a failed snapshot fetch must not freeze the live canvas
    }
  }

  // Retry the snapshot resync with backoff after a failed fetch on a recovery path (reconnect /
  // region-rollback). It retries #loadSnapshotAndFlush, NOT #reconnect, so it reuses the already-open
  // socket instead of leaking a second one. start()'s initial-load failure is intentionally NOT routed
  // here — its rejection surfaces the "Could not load" UI.
  #scheduleResync(): void {
    if (this.#stopped) return;
    const delay = this.#opts.reconnectDelayMs ?? 1000;
    const schedule = this.#opts.schedule ?? ((fn, ms) => setTimeout(fn, ms));
    schedule(() => {
      void this.#resync();
    }, delay);
  }

  async #resync(): Promise<void> {
    if (this.#stopped || !this.#buffer) return;
    try {
      await this.#loadSnapshotAndFlush();
    } catch {
      this.#scheduleResync();
    }
  }

  async #loadSnapshotAndFlush(): Promise<void> {
    const snapshot = await this.#opts.fetchSnapshot();
    if (this.#stopped || !this.#buffer) return;
    this.#buffer.loadSnapshot(snapshot);
    this.#snapshotLoaded = true;
    for (const delta of this.#pending) this.#applyLive(delta);
    this.#pending = [];
    this.#opts.onUpdate(this.#buffer, { palette: this.#palette });
  }

  #onMessage(data: unknown): void {
    if (typeof data !== 'string') return;
    let message: ws.ServerToClientMessage;
    try {
      message = JSON.parse(data) as ws.ServerToClientMessage;
    } catch {
      return;
    }
    if (message.type === 'RegionRolledBack') {
      // A region changed at once — resync the snapshot. Queue deltas during the refetch (clear the
      // loaded flag) so none are lost or applied to the stale buffer; the watermark dedupes the rest.
      if (this.#snapshotLoaded && !this.#stopped) {
        this.#snapshotLoaded = false;
        void this.#loadSnapshotAndFlush().catch(() => this.#scheduleResync()); // retry on a failed resync
      }
      return;
    }
    if (message.type !== 'PixelPlaced' && message.type !== 'PixelRolledBack') return; // others ignored
    if (!this.#snapshotLoaded || !this.#buffer) {
      this.#pending.push(message); // arrived before the snapshot — apply after it loads
      return;
    }
    if (this.#applyLive(message)) {
      this.#opts.onUpdate(this.#buffer, { palette: this.#palette });
    }
  }

  #applyLive(message: ws.PixelPlaced | ws.PixelRolledBack): boolean {
    if (!this.#buffer) return false;
    return message.type === 'PixelPlaced' ? this.#buffer.applyDelta(message) : this.#buffer.applyRollback(message);
  }

  /** Stop the live connection (component unmount). No further reconnects. */
  stop(): void {
    this.#stopped = true;
    this.#socket?.close();
    this.#socket = null;
  }
}
