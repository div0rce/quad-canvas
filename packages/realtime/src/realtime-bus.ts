// @quad/realtime — fan-out bus. Decouples "a change happened" (published by the authoritative tier
// on a successful placement) from "deliver it to connected clients" (the WS layer). A node both
// publishes to the bus and subscribes to it, so a placement on one node reaches subscribers on any
// node. Messages are tenant+canvas scoped. The in-memory bus below serves a single node / tests;
// the Redis-backed implementation (cross-node pub/sub) plugs into the same interface.
import type { ws } from '@quad/core';

export interface BusMessage {
  readonly tenantId: string;
  readonly canvasId: string;
  readonly message: ws.ServerToClientMessage;
}

export type BusHandler = (message: BusMessage) => void;

export interface RealtimeBus {
  /** Resolve once the bus is ready to deliver (e.g. the subscription is active). */
  ready(): Promise<void>;
  /** Publish a tenant+canvas-scoped message to all nodes (including this one). */
  publish(tenantId: string, canvasId: string, message: ws.ServerToClientMessage): Promise<void>;
  /** Subscribe to delivered messages; returns an unsubscribe function. */
  subscribe(handler: BusHandler): () => void;
  /** Release resources (connections, listeners). */
  close(): Promise<void>;
}

/**
 * Single-node bus: a publish is delivered synchronously to local subscribers. One handler throwing
 * does not stop delivery to the others. Suitable for single-instance deployments and tests; the
 * Redis-backed bus replaces it for horizontal scale.
 */
export class InMemoryRealtimeBus implements RealtimeBus {
  readonly #handlers = new Set<BusHandler>();

  ready(): Promise<void> {
    return Promise.resolve();
  }

  publish(tenantId: string, canvasId: string, message: ws.ServerToClientMessage): Promise<void> {
    const busMessage: BusMessage = { tenantId, canvasId, message };
    for (const handler of this.#handlers) {
      try {
        handler(busMessage);
      } catch {
        // A failing subscriber must not break delivery to the rest.
      }
    }
    return Promise.resolve();
  }

  subscribe(handler: BusHandler): () => void {
    this.#handlers.add(handler);
    return () => {
      this.#handlers.delete(handler);
    };
  }

  close(): Promise<void> {
    this.#handlers.clear();
    return Promise.resolve();
  }
}
