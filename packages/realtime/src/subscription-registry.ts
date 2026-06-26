// @quad/realtime — in-memory subscription registry. Tracks live connections and which canvas each
// is subscribed to, so the server can fan a message out to exactly the right subscribers. Channels
// are tenant-scoped (WS-DP-3 / WS-INV-3): a broadcast only reaches connections of the same tenant.
// Transport-agnostic — `send` is wired to the real socket by the WS plugin; this module is pure and
// unit-testable. (Cross-node fan-out via Redis pub/sub is layered on top in a later milestone.)
import type { ws } from '@quad/core';

/** A live client connection. `send` delivers a server→client message over its transport. */
export interface RealtimeConnection {
  readonly id: string;
  readonly tenantId: string;
  send(message: ws.ServerToClientMessage): void;
}

interface ConnectionEntry {
  readonly conn: RealtimeConnection;
  readonly canvasIds: Set<string>;
}

export class SubscriptionRegistry {
  readonly #connections = new Map<string, ConnectionEntry>();
  readonly #byCanvas = new Map<string, Set<string>>();

  /** Register a connection (idempotent). */
  add(conn: RealtimeConnection): void {
    if (!this.#connections.has(conn.id)) {
      this.#connections.set(conn.id, { conn, canvasIds: new Set() });
    }
  }

  /** Remove a connection and all its subscriptions. */
  remove(connectionId: string): void {
    const entry = this.#connections.get(connectionId);
    if (!entry) return;
    for (const canvasId of entry.canvasIds) {
      const set = this.#byCanvas.get(canvasId);
      set?.delete(connectionId);
      if (set && set.size === 0) this.#byCanvas.delete(canvasId);
    }
    this.#connections.delete(connectionId);
  }

  /** Subscribe a known connection to a canvas (idempotent). No-op for unknown connections. */
  subscribe(connectionId: string, canvasId: string): void {
    const entry = this.#connections.get(connectionId);
    if (!entry) return;
    entry.canvasIds.add(canvasId);
    let set = this.#byCanvas.get(canvasId);
    if (!set) {
      set = new Set();
      this.#byCanvas.set(canvasId, set);
    }
    set.add(connectionId);
  }

  /** Unsubscribe a connection from a canvas (idempotent). */
  unsubscribe(connectionId: string, canvasId: string): void {
    this.#connections.get(connectionId)?.canvasIds.delete(canvasId);
    const set = this.#byCanvas.get(canvasId);
    set?.delete(connectionId);
    if (set && set.size === 0) this.#byCanvas.delete(canvasId);
  }

  /**
   * Deliver a message to every connection of `tenantId` subscribed to `canvasId`.
   * The tenant filter is defense-in-depth against cross-tenant leakage. Returns the number sent.
   */
  broadcast(tenantId: string, canvasId: string, message: ws.ServerToClientMessage): number {
    const set = this.#byCanvas.get(canvasId);
    if (!set) return 0;
    let sent = 0;
    for (const connectionId of set) {
      const entry = this.#connections.get(connectionId);
      if (entry && entry.conn.tenantId === tenantId) {
        try {
          entry.conn.send(message);
          sent += 1;
        } catch {
          // A single broken transport must not abort fan-out to the rest of the subscribers.
        }
      }
    }
    return sent;
  }

  /** Number of connections subscribed to a canvas. */
  subscriberCount(canvasId: string): number {
    return this.#byCanvas.get(canvasId)?.size ?? 0;
  }

  /** Total live connections. */
  connectionCount(): number {
    return this.#connections.size;
  }
}
