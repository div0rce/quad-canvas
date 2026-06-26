import { describe, it, expect } from 'vitest';
import type { ws } from '@quad/core';
import { InMemoryRealtimeBus, type BusMessage } from '../realtime-bus.js';
import { SubscriptionRegistry, type RealtimeConnection } from '../subscription-registry.js';

const HEARTBEAT: ws.ServerToClientMessage = { type: 'Heartbeat' };

function fakeConn(id: string, tenantId: string): { conn: RealtimeConnection; received: ws.ServerToClientMessage[] } {
  const received: ws.ServerToClientMessage[] = [];
  return { conn: { id, tenantId, send: (m) => received.push(m) }, received };
}

describe('InMemoryRealtimeBus', () => {
  it('delivers published messages to subscribers and stops after unsubscribe', async () => {
    const bus = new InMemoryRealtimeBus();
    const got: BusMessage[] = [];
    const unsub = bus.subscribe((m) => got.push(m));

    await bus.publish('ten_1', 'canvas_1', HEARTBEAT);
    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({ tenantId: 'ten_1', canvasId: 'canvas_1' });

    unsub();
    await bus.publish('ten_1', 'canvas_1', HEARTBEAT);
    expect(got).toHaveLength(1);
  });

  it('fans a published message out to the local subscription registry', async () => {
    const bus = new InMemoryRealtimeBus();
    const registry = new SubscriptionRegistry();
    bus.subscribe((m) => registry.broadcast(m.tenantId, m.canvasId, m.message));

    const a = fakeConn('a', 'ten_1');
    registry.add(a.conn);
    registry.subscribe('a', 'canvas_1');

    await bus.publish('ten_1', 'canvas_1', HEARTBEAT);
    expect(a.received).toEqual([HEARTBEAT]);
  });

  it('one failing subscriber does not stop delivery to others', async () => {
    const bus = new InMemoryRealtimeBus();
    const got: BusMessage[] = [];
    bus.subscribe(() => {
      throw new Error('boom');
    });
    bus.subscribe((m) => got.push(m));

    await bus.publish('t', 'c', HEARTBEAT);
    expect(got).toHaveLength(1);
  });
});
