import { describe, it, expect } from 'vitest';
import type { domain, dto } from '@quad/core';
import { CanvasClient, type SocketLike } from './canvas-client';

function fakeSocket(): SocketLike & { sent: string[] } {
  const sent: string[] = [];
  return {
    sent,
    send: (d) => sent.push(d),
    close: () => undefined,
    onopen: null,
    onmessage: null,
    onclose: null,
    onerror: null,
  };
}

const meta: dto.CanvasMetaResponse = {
  id: 'canvas_1' as domain.CanvasId,
  term: 'F26',
  status: 'active',
  width: 4,
  height: 4,
  palette: 'default',
};

const emptySnapshot: dto.CanvasSnapshotResponse = { width: 4, height: 4, seq: 0 as domain.PerCanvasSequence, cells: [] };

describe('CanvasClient', () => {
  it('loads the snapshot, subscribes on open, and applies live deltas', async () => {
    const socket = fakeSocket();
    const updateSeqs: number[] = [];
    const client = new CanvasClient({
      fetchMeta: () => Promise.resolve(meta),
      fetchSnapshot: () => Promise.resolve(emptySnapshot),
      openSocket: () => socket,
      onUpdate: (buffer) => updateSeqs.push(buffer.seq),
    });

    await client.start();
    expect(client.buffer?.width).toBe(4);
    expect(updateSeqs).toHaveLength(1); // repaint after snapshot

    // WS opens → subscribe to the current canvas.
    socket.onopen?.();
    expect(socket.sent).toHaveLength(1);
    expect(socket.sent[0]).toContain('SubscribeCanvas');
    expect(socket.sent[0]).toContain('canvas_1');

    // A live delta is applied to the buffer and triggers a repaint.
    socket.onmessage?.({ data: JSON.stringify({ type: 'PixelPlaced', at: { x: 1, y: 1 }, color: 2, seq: 1 }) });
    expect(client.buffer?.colorAt(1, 1)).toBe(2);
    expect(updateSeqs).toHaveLength(2);
  });

  it('ignores non-PixelPlaced and malformed messages', async () => {
    const socket = fakeSocket();
    let updates = 0;
    const client = new CanvasClient({
      fetchMeta: () => Promise.resolve(meta),
      fetchSnapshot: () => Promise.resolve(emptySnapshot),
      openSocket: () => socket,
      onUpdate: () => {
        updates += 1;
      },
    });
    await client.start();
    socket.onmessage?.({ data: JSON.stringify({ type: 'Heartbeat' }) });
    socket.onmessage?.({ data: 'not json' });
    expect(updates).toBe(1); // only the initial snapshot repaint
  });

  it('queues deltas that arrive before the snapshot and applies them after (no gap)', async () => {
    const socket = fakeSocket();
    let resolveSnapshot: (s: dto.CanvasSnapshotResponse) => void = () => undefined;
    const snapshotPromise = new Promise<dto.CanvasSnapshotResponse>((r) => {
      resolveSnapshot = r;
    });
    const client = new CanvasClient({
      fetchMeta: () => Promise.resolve(meta),
      fetchSnapshot: () => snapshotPromise,
      openSocket: () => socket,
      onUpdate: () => undefined,
    });

    const started = client.start();
    // Let start() connect and suspend on the (still-pending) snapshot fetch.
    await new Promise((r) => setTimeout(r, 0));
    socket.onopen?.(); // WS opens → subscribe
    expect(socket.sent[0]).toContain('SubscribeCanvas');
    // A delta arrives before the snapshot — it must be queued, not dropped.
    socket.onmessage?.({ data: JSON.stringify({ type: 'PixelPlaced', at: { x: 2, y: 2 }, color: 5, seq: 3 }) });
    resolveSnapshot(emptySnapshot);
    await started;

    expect(client.buffer?.colorAt(2, 2)).toBe(5);
  });
});
