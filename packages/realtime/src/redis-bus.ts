// @quad/realtime — Redis-backed fan-out bus (cross-node). Implements the same RealtimeBus interface
// as the in-memory bus, so a placement published on one api node reaches WS subscribers on every
// node. Uses two connections (Redis requires a dedicated connection in subscriber mode). A single
// channel carries tenant+canvas-scoped envelopes; each node delivers to its own subscribers, where
// the SubscriptionRegistry applies tenant/canvas scoping (Redis is transport only — WS-INV / DB-INV).
import { Redis } from 'ioredis';
import type { ws } from '@quad/core';
import type { RealtimeBus, BusHandler, BusMessage } from './realtime-bus.js';

const CHANNEL = 'quad:realtime:v1';

export class RedisRealtimeBus implements RealtimeBus {
  readonly #pub: Redis;
  readonly #sub: Redis;
  readonly #ready: Promise<void>;
  readonly #handlers = new Set<BusHandler>();

  constructor(connectionString: string) {
    this.#pub = new Redis(connectionString);
    this.#sub = new Redis(connectionString);
    this.#ready = this.#sub.subscribe(CHANNEL).then(() => undefined);
    this.#sub.on('message', (_channel: string, payload: string) => {
      let busMessage: BusMessage;
      try {
        busMessage = JSON.parse(payload) as BusMessage;
      } catch {
        return;
      }
      for (const handler of this.#handlers) {
        try {
          handler(busMessage);
        } catch {
          // A failing subscriber must not break delivery to the rest.
        }
      }
    });
  }

  ready(): Promise<void> {
    return this.#ready;
  }

  async publish(tenantId: string, canvasId: string, message: ws.ServerToClientMessage): Promise<void> {
    const busMessage: BusMessage = { tenantId, canvasId, message };
    await this.#pub.publish(CHANNEL, JSON.stringify(busMessage));
  }

  subscribe(handler: BusHandler): () => void {
    this.#handlers.add(handler);
    return () => {
      this.#handlers.delete(handler);
    };
  }

  async close(): Promise<void> {
    this.#handlers.clear();
    await Promise.all([this.#pub.quit(), this.#sub.quit()]);
  }
}
