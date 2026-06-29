// apps/web — canvas controller. Framework-agnostic orchestration of the live view: open the
// WebSocket and wait for the server's subscription acknowledgement FIRST (queuing deltas), then
// fetch the REST snapshot, load a @quad/render CanvasBuffer, and flush the queued deltas — so no
// delta is lost in the gap between snapshot and subscription. On an
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
  // Bumped on every (re)connect AND close, so a snapshot load that was in flight across a reconnect or
  // close is recognized as stale and discarded (it must not set #snapshotLoaded for a dead connection).
  #generation = 0;
  // Recovery backoff attempt counter; reset to 0 on a successful snapshot load.
  #retryAttempt = 0;

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
    await this.#connectAndSubscribe();
    await this.#loadSnapshotAndFlush();
  }

  #connectAndSubscribe(): Promise<void> {
    this.#generation += 1; // a new connection supersedes any in-flight snapshot load
    const generation = this.#generation;
    const socket = this.#opts.openSocket();
    this.#socket = socket;
    return new Promise<void>((resolve, reject) => {
      let acknowledged = false;
      const rejectBeforeAck = (): void => {
        if (!acknowledged) reject(new Error('WebSocket closed before canvas subscription was acknowledged.'));
      };
      socket.onopen = () => {
        if (this.#canvasId !== null && socket === this.#socket && generation === this.#generation) {
          socket.send(JSON.stringify({ type: 'SubscribeCanvas', canvasId: this.#canvasId }));
        }
      };
      socket.onmessage = (event) => {
        if (socket !== this.#socket || generation !== this.#generation) return;
        const message = this.#parseMessage(event.data);
        if (!message) return;
        if (message.type === 'CanvasSubscribed' && message.canvasId === this.#canvasId) {
          acknowledged = true;
          resolve();
          return;
        }
        this.#onMessage(message);
      };
      socket.onclose = () => {
        if (socket !== this.#socket || generation !== this.#generation) return;
        rejectBeforeAck();
        this.#onClose(socket);
      };
      socket.onerror = () => {
        rejectBeforeAck();
        // Browsers normally emit close after error, but closing explicitly makes recovery reliable
        // for injected/non-browser transports that emit only error.
        socket.close();
      };
    });
  }

  #onClose(socket: SocketLike): void {
    if (socket !== this.#socket) return;
    this.#socket = null;
    this.#generation += 1; // invalidate any in-flight snapshot load for the now-dead connection
    if (this.#stopped) return;
    // Queue deltas until we have re-synced against a fresh snapshot.
    this.#snapshotLoaded = false;
    this.#scheduleRecovery(() => this.#reconnect());
  }

  // Schedule a recovery attempt with exponential backoff + a cap + jitter, so a sustained outage does
  // not hammer the API roughly once a second forever (thundering herd). The attempt counter resets on
  // a successful snapshot load (#loadSnapshotAndFlush).
  #scheduleRecovery(run: () => Promise<void>): void {
    if (this.#stopped) return;
    const base = this.#opts.reconnectDelayMs ?? 1000;
    const ceiling = Math.min(30_000, base * 2 ** this.#retryAttempt);
    this.#retryAttempt += 1;
    const delay = ceiling / 2 + Math.random() * (ceiling / 2); // half-jittered: [ceiling/2, ceiling]
    const schedule = this.#opts.schedule ?? ((fn, ms) => setTimeout(fn, ms));
    schedule(() => {
      void run();
    }, delay);
  }

  async #reconnect(): Promise<void> {
    if (this.#stopped || !this.#buffer) return;
    try {
      await this.#connectAndSubscribe();
      await this.#loadSnapshotAndFlush();
    } catch {
      // A close schedules a new connection in #onClose. If the connection is still open, only the
      // snapshot failed, so reuse it and retry the resync.
      if (this.#socket) this.#scheduleResync();
    }
  }

  // Retry the snapshot resync (reusing the open socket, NOT a new connection) after a failed fetch on a
  // recovery path (reconnect / region-rollback). start()'s initial-load failure is intentionally NOT
  // routed here — its rejection surfaces the "Could not load" UI.
  #scheduleResync(): void {
    this.#scheduleRecovery(() => this.#resync());
  }

  async #resync(): Promise<void> {
    // If the socket is gone (a close happened since this was scheduled), let #onClose's reconnect own
    // recovery — don't load a snapshot for a dead connection (which would set #snapshotLoaded with no
    // live subscription, dropping deltas until the next reconnect).
    if (this.#stopped || !this.#buffer || !this.#socket) return;
    try {
      await this.#loadSnapshotAndFlush();
    } catch {
      this.#scheduleResync();
    }
  }

  async #loadSnapshotAndFlush(): Promise<void> {
    const gen = this.#generation;
    const snapshot = await this.#opts.fetchSnapshot();
    // Discard a load superseded by a reconnect/close while the fetch was in flight (stale generation) —
    // otherwise it would mark #snapshotLoaded for a connection that is no longer the live one.
    if (this.#stopped || !this.#buffer || gen !== this.#generation) return;
    this.#buffer.loadSnapshot(snapshot);
    this.#snapshotLoaded = true;
    this.#retryAttempt = 0; // recovered → reset the backoff
    for (const delta of this.#pending) this.#applyLive(delta);
    this.#pending = [];
    this.#opts.onUpdate(this.#buffer, { palette: this.#palette });
  }

  #parseMessage(data: unknown): ws.ServerToClientMessage | null {
    if (typeof data !== 'string') return null;
    try {
      const parsed = JSON.parse(data) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
      const message = parsed as Record<string, unknown>;
      if (message['type'] === 'CanvasSubscribed' && typeof message['canvasId'] === 'string') {
        return parsed as ws.CanvasSubscribed;
      }
      if (message['type'] === 'PixelPlaced' || message['type'] === 'PixelRolledBack') {
        const at = message['at'];
        if (!at || typeof at !== 'object' || Array.isArray(at)) return null;
        const coordinate = at as Record<string, unknown>;
        if (!Number.isInteger(coordinate['x']) || !Number.isInteger(coordinate['y']) || !Number.isInteger(message['seq'])) return null;
        if (message['type'] === 'PixelPlaced' && !Number.isInteger(message['color'])) return null;
        if (message['type'] === 'PixelRolledBack' && message['color'] !== undefined && !Number.isInteger(message['color'])) return null;
        return parsed as ws.PixelPlaced | ws.PixelRolledBack;
      }
      if (message['type'] === 'RegionRolledBack') {
        const region = message['region'];
        if (!region || typeof region !== 'object' || Array.isArray(region)) return null;
        const values = region as Record<string, unknown>;
        if (!['x1', 'y1', 'x2', 'y2'].every((key) => Number.isInteger(values[key]))) return null;
        return parsed as ws.RegionRolledBack;
      }
      if (
        message['type'] === 'CanvasLifecycleChanged' &&
        typeof message['status'] === 'string' &&
        Number.isInteger(message['seq'])
      ) {
        return parsed as ws.CanvasLifecycleChanged;
      }
      return null;
    } catch {
      return null;
    }
  }

  #onMessage(message: ws.ServerToClientMessage): void {
    if (message.type === 'RegionRolledBack') {
      // A region changed at once — resync the snapshot. Queue deltas during the refetch (clear the
      // loaded flag) so none are lost or applied to the stale buffer; the watermark dedupes the rest.
      if (this.#snapshotLoaded && !this.#stopped) {
        this.#snapshotLoaded = false;
        void this.#loadSnapshotAndFlush().catch(() => this.#scheduleResync()); // retry on a failed resync
      }
      return;
    }
    if (message.type === 'CanvasLifecycleChanged') {
      // Lifecycle facts consume the same per-canvas sequence as pixel events. Refresh the snapshot
      // so the buffer advances through that non-pixel sequence and later pixel deltas stay contiguous.
      if (this.#snapshotLoaded && !this.#stopped) {
        this.#snapshotLoaded = false;
        void this.#loadSnapshotAndFlush().catch(() => this.#scheduleResync());
      }
      return;
    }
    if (message.type !== 'PixelPlaced' && message.type !== 'PixelRolledBack') return; // others ignored
    if (!this.#snapshotLoaded || !this.#buffer) {
      this.#pending.push(message); // arrived before the snapshot — apply after it loads
      return;
    }
    if (message.seq > this.#buffer.seq + 1) {
      // Never advance the watermark across a missing event. Queue this delta and recover from a
      // snapshot; its watermark will either include the delta or make it the next contiguous one.
      this.#pending.push(message);
      this.#snapshotLoaded = false;
      void this.#loadSnapshotAndFlush().catch(() => this.#scheduleResync());
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

  /** Feed a successful REST placement through the same sequence/gap guard as its WS echo. */
  applyConfirmedPlacement(result: dto.PlacePixelResultResponse): void {
    this.#onMessage({ type: 'PixelPlaced', at: result.at, color: result.color, seq: result.seq });
  }

  /** Stop the live connection (component unmount). No further reconnects. */
  stop(): void {
    this.#stopped = true;
    this.#socket?.close();
    this.#socket = null;
  }
}
