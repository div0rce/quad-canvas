import { describe, it, expect } from 'vitest';
import type { ws } from '@quad/core';
import { SubscriptionRegistry, type RealtimeConnection } from '../subscription-registry.js';

const HEARTBEAT: ws.ServerToClientMessage = { type: 'Heartbeat' };

function fakeConn(id: string, tenantId: string): { conn: RealtimeConnection; received: ws.ServerToClientMessage[] } {
  const received: ws.ServerToClientMessage[] = [];
  return { conn: { id, tenantId, send: (m) => received.push(m) }, received };
}

describe('SubscriptionRegistry', () => {
  it('broadcasts to subscribers of a canvas and reports the count', () => {
    const reg = new SubscriptionRegistry();
    const a = fakeConn('a', 'ten_1');
    const b = fakeConn('b', 'ten_1');
    reg.add(a.conn);
    reg.add(b.conn);
    reg.subscribe('a', 'canvas_1');
    reg.subscribe('b', 'canvas_1');

    const sent = reg.broadcast('ten_1', 'canvas_1', HEARTBEAT);
    expect(sent).toBe(2);
    expect(a.received).toEqual([HEARTBEAT]);
    expect(b.received).toEqual([HEARTBEAT]);
    expect(reg.subscriberCount('canvas_1')).toBe(2);
  });

  it('does not leak across tenants (tenant-scoped channels)', () => {
    const reg = new SubscriptionRegistry();
    const a = fakeConn('a', 'ten_1');
    const intruder = fakeConn('x', 'ten_2');
    reg.add(a.conn);
    reg.add(intruder.conn);
    reg.subscribe('a', 'canvas_1');
    reg.subscribe('x', 'canvas_1');

    const sent = reg.broadcast('ten_1', 'canvas_1', HEARTBEAT);
    expect(sent).toBe(1);
    expect(a.received).toHaveLength(1);
    expect(intruder.received).toHaveLength(0);
  });

  it('stops delivering after unsubscribe and remove', () => {
    const reg = new SubscriptionRegistry();
    const a = fakeConn('a', 'ten_1');
    reg.add(a.conn);
    reg.subscribe('a', 'canvas_1');

    reg.unsubscribe('a', 'canvas_1');
    expect(reg.broadcast('ten_1', 'canvas_1', HEARTBEAT)).toBe(0);
    expect(reg.subscriberCount('canvas_1')).toBe(0);

    reg.subscribe('a', 'canvas_1');
    reg.remove('a');
    expect(reg.broadcast('ten_1', 'canvas_1', HEARTBEAT)).toBe(0);
    expect(reg.connectionCount()).toBe(0);
    expect(a.received).toHaveLength(0);
  });

  it('broadcast to an empty canvas sends nothing', () => {
    const reg = new SubscriptionRegistry();
    expect(reg.broadcast('ten_1', 'canvas_none', HEARTBEAT)).toBe(0);
  });

  it('subscribe is a no-op for unknown connections', () => {
    const reg = new SubscriptionRegistry();
    reg.subscribe('ghost', 'canvas_1');
    expect(reg.subscriberCount('canvas_1')).toBe(0);
  });
});
