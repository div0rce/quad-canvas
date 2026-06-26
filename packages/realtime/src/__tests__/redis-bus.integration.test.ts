import { describe, it, expect } from 'vitest';
import type { ws } from '@quad/core';
import { RedisRealtimeBus } from '../redis-bus.js';
import type { BusMessage } from '../realtime-bus.js';

// Requires the local Docker Compose Redis (see vitest.integration.config.ts).
const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://127.0.0.1:6379';
const HEARTBEAT: ws.ServerToClientMessage = { type: 'Heartbeat' };

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('RedisRealtimeBus (cross-node)', () => {
  it('delivers a published message to a separate subscriber instance', async () => {
    // Two instances = two nodes sharing one Redis.
    const publisher = new RedisRealtimeBus(REDIS_URL);
    const subscriber = new RedisRealtimeBus(REDIS_URL);
    try {
      const received = new Promise<BusMessage>((resolve) => subscriber.subscribe(resolve));
      await delay(250); // let the subscriber's SUBSCRIBE take effect before publishing
      await publisher.publish('ten_1', 'canvas_1', HEARTBEAT);
      const msg = await received;
      expect(msg).toMatchObject({ tenantId: 'ten_1', canvasId: 'canvas_1' });
      expect(msg.message.type).toBe('Heartbeat');
    } finally {
      await publisher.close();
      await subscriber.close();
    }
  });
});
