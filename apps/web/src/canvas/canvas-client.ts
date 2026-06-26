// apps/web — canvas controller. Framework-agnostic orchestration of the live view: open the
// WebSocket and subscribe FIRST (queuing deltas), then fetch the REST snapshot, load a @quad/render
// CanvasBuffer, and flush the queued deltas — so no delta is lost in the gap between snapshot and
// subscription (the buffer's seq watermark drops any that the snapshot already covers). Network +
// socket are injected so this is unit-testable in Node. Read/view only — placement is gated (M20).
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
}

export class CanvasClient {
  readonly #opts: CanvasClientOptions;
  #buffer: CanvasBuffer | null = null;
  #socket: SocketLike | null = null;
  #canvasId: string | null = null;
  #palette = 'default';
  #snapshotLoaded = false;
  #pending: ws.PixelPlaced[] = [];
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
    // Subscribe BEFORE fetching the snapshot so any delta in the gap is queued, not lost.
    if (!this.#stopped) this.#connect();

    const snapshot = await this.#opts.fetchSnapshot();
    if (this.#stopped || !this.#buffer) return;
    this.#buffer.loadSnapshot(snapshot);
    this.#snapshotLoaded = true;
    for (const delta of this.#pending) this.#buffer.applyDelta(delta);
    this.#pending = [];
    this.#opts.onUpdate(this.#buffer, { palette: this.#palette });
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
  }

  #onMessage(data: unknown): void {
    if (typeof data !== 'string') return;
    let message: ws.ServerToClientMessage;
    try {
      message = JSON.parse(data) as ws.ServerToClientMessage;
    } catch {
      return;
    }
    if (message.type !== 'PixelPlaced') return; // Heartbeat / Error / others ignored this milestone
    if (!this.#snapshotLoaded || !this.#buffer) {
      this.#pending.push(message); // arrived before the snapshot — apply after it loads
      return;
    }
    if (this.#buffer.applyDelta(message)) {
      this.#opts.onUpdate(this.#buffer, { palette: this.#palette });
    }
  }

  /** Stop the live connection (component unmount). */
  stop(): void {
    this.#stopped = true;
    this.#socket?.close();
    this.#socket = null;
  }
}
