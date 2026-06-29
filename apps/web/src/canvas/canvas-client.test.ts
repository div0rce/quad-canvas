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

async function nextTurn(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function acknowledge(socket: ReturnType<typeof fakeSocket>, canvasId = 'canvas_1'): void {
  socket.onopen?.();
  socket.onmessage?.({ data: JSON.stringify({ type: 'CanvasSubscribed', canvasId }) });
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

    const started = client.start();
    await nextTurn();
    acknowledge(socket);
    await started;
    expect(client.buffer?.width).toBe(4);
    expect(updateSeqs).toHaveLength(1); // repaint after snapshot

    // WS opened and the server acknowledged the installed subscription before the snapshot.
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
    const started = client.start();
    await nextTurn();
    acknowledge(socket);
    await started;
    socket.onmessage?.({ data: JSON.stringify({ type: 'Heartbeat' }) });
    socket.onmessage?.({ data: 'not json' });
    socket.onmessage?.({ data: JSON.stringify({ type: 'PixelPlaced', color: 2, seq: 1 }) });
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
    acknowledge(socket); // WS opens → subscribe → server acknowledgement
    expect(socket.sent[0]).toContain('SubscribeCanvas');
    // A delta arrives before the snapshot — it must be queued, not dropped.
    socket.onmessage?.({ data: JSON.stringify({ type: 'PixelPlaced', at: { x: 2, y: 2 }, color: 5, seq: 1 }) });
    resolveSnapshot(emptySnapshot);
    await started;

    expect(client.buffer?.colorAt(2, 2)).toBe(5);
  });

  it('orders mixed REST and WebSocket facts by seq while a snapshot is loading', async () => {
    const socket = fakeSocket();
    let resolveSnapshot: (snapshot: dto.CanvasSnapshotResponse) => void = () => undefined;
    const snapshotPromise = new Promise<dto.CanvasSnapshotResponse>((resolve) => {
      resolveSnapshot = resolve;
    });
    const client = new CanvasClient({
      fetchMeta: () => Promise.resolve(meta),
      fetchSnapshot: () => snapshotPromise,
      openSocket: () => socket,
      onUpdate: () => undefined,
    });

    const started = client.start();
    await nextTurn();
    acknowledge(socket);
    await nextTurn();
    // The REST response for seq 2 can beat another actor's lower WS event to the client.
    client.applyConfirmedPlacement({
      at: { x: 2, y: 2 },
      color: 5,
      seq: 2 as domain.PerCanvasSequence,
      placedAt: '2026-06-29T00:00:00.000Z',
      cooldownMs: 0,
    }, 'canvas_1');
    socket.onmessage?.({ data: JSON.stringify({ type: 'PixelPlaced', at: { x: 1, y: 1 }, color: 4, seq: 1 }) });
    resolveSnapshot(emptySnapshot);
    await started;

    expect(client.buffer?.seq).toBe(2);
    expect(client.buffer?.colorAt(1, 1)).toBe(4);
    expect(client.buffer?.colorAt(2, 2)).toBe(5);
  });

  it('reconnects and re-subscribes after an unexpected close', async () => {
    const sockets: Array<ReturnType<typeof fakeSocket>> = [];
    const client = new CanvasClient({
      fetchMeta: () => Promise.resolve(meta),
      fetchSnapshot: () => Promise.resolve(emptySnapshot),
      openSocket: () => {
        const s = fakeSocket();
        sockets.push(s);
        return s;
      },
      onUpdate: () => undefined,
      schedule: (fn) => {
        fn(); // run the reconnect immediately
      },
    });

    const started = client.start();
    await nextTurn();
    acknowledge(sockets[0]!);
    await started;
    expect(sockets).toHaveLength(1);
    expect(sockets[0]?.sent[0]).toContain('SubscribeCanvas');

    // The connection drops → the client reconnects and re-subscribes.
    sockets[0]?.onclose?.();
    await nextTurn();
    expect(sockets).toHaveLength(2);
    acknowledge(sockets[1]!);
    await nextTurn(); // let the reconnect's snapshot fetch resolve
    expect(sockets[1]?.sent[0]).toContain('SubscribeCanvas');

    // After re-sync, deltas apply again.
    sockets[1]?.onmessage?.({ data: JSON.stringify({ type: 'PixelPlaced', at: { x: 0, y: 0 }, color: 1, seq: 1 }) });
    expect(client.buffer?.colorAt(0, 0)).toBe(1);
  });

  it('retries the snapshot resync after a failed fetch on reconnect (no freeze)', async () => {
    const sockets: Array<ReturnType<typeof fakeSocket>> = [];
    let snapCalls = 0;
    const client = new CanvasClient({
      fetchMeta: () => Promise.resolve(meta),
      fetchSnapshot: () => {
        snapCalls += 1;
        // start() succeeds (1); the reconnect's resync fails once (2) then a retry succeeds (3).
        return snapCalls === 2 ? Promise.reject(new Error('snapshot 503')) : Promise.resolve(emptySnapshot);
      },
      openSocket: () => {
        const s = fakeSocket();
        sockets.push(s);
        return s;
      },
      onUpdate: () => undefined,
      schedule: (fn) => {
        fn(); // run the reconnect + resync retries immediately
      },
    });

    const started = client.start();
    await nextTurn();
    acknowledge(sockets[0]!);
    await started;
    expect(sockets).toHaveLength(1);

    // Drop the connection: reconnect (socket 2) → snapshot REJECTS → a resync retry is scheduled →
    // the retry RESOLVES. The retry re-fetches the snapshot only (reuses socket 2 — no third socket).
    sockets[0]?.onclose?.();
    await nextTurn();
    acknowledge(sockets[1]!);
    for (let i = 0; i < 4; i++) await nextTurn(); // let the fail + retry settle
    expect(snapCalls).toBeGreaterThanOrEqual(3); // start + failed reconnect + successful retry
    expect(sockets).toHaveLength(2); // resync reused the reconnect's socket, not a new one

    // Recovered (not frozen): the reconnected socket delivers deltas again.
    sockets[1]?.onmessage?.({ data: JSON.stringify({ type: 'PixelPlaced', at: { x: 0, y: 0 }, color: 1, seq: 1 }) });
    expect(client.buffer?.colorAt(0, 0)).toBe(1);
  });

  it('does not reconnect after stop()', async () => {
    const sockets: Array<ReturnType<typeof fakeSocket>> = [];
    const client = new CanvasClient({
      fetchMeta: () => Promise.resolve(meta),
      fetchSnapshot: () => Promise.resolve(emptySnapshot),
      openSocket: () => {
        const s = fakeSocket();
        sockets.push(s);
        return s;
      },
      onUpdate: () => undefined,
      schedule: (fn) => {
        fn();
      },
    });
    const started = client.start();
    await nextTurn();
    acknowledge(sockets[0]!);
    await started;
    client.stop();
    sockets[0]?.onclose?.();
    await new Promise((r) => setTimeout(r, 0));
    expect(sockets).toHaveLength(1); // no reconnect
  });

  it('does not fetch the snapshot until the server acknowledges the subscription', async () => {
    const socket = fakeSocket();
    let snapshotCalls = 0;
    const client = new CanvasClient({
      fetchMeta: () => Promise.resolve(meta),
      fetchSnapshot: () => {
        snapshotCalls += 1;
        return Promise.resolve(emptySnapshot);
      },
      openSocket: () => socket,
      onUpdate: () => undefined,
    });

    const started = client.start();
    await nextTurn();
    expect(snapshotCalls).toBe(0);
    socket.onopen?.();
    await nextTurn();
    expect(snapshotCalls).toBe(0);
    socket.onmessage?.({ data: JSON.stringify({ type: 'CanvasSubscribed', canvasId: 'canvas_1' }) });
    await started;
    expect(snapshotCalls).toBe(1);
  });

  it('resnapshots on a sequence gap instead of advancing past a missing update', async () => {
    const socket = fakeSocket();
    let snapshotCalls = 0;
    const client = new CanvasClient({
      fetchMeta: () => Promise.resolve(meta),
      fetchSnapshot: () => {
        snapshotCalls += 1;
        return Promise.resolve(
          snapshotCalls === 1
            ? emptySnapshot
            : { width: 4, height: 4, seq: 2 as domain.PerCanvasSequence, cells: [{ x: 1, y: 1, color: 4 as domain.ColorIndex }] },
        );
      },
      openSocket: () => socket,
      onUpdate: () => undefined,
    });
    const started = client.start();
    await nextTurn();
    acknowledge(socket);
    await started;

    socket.onmessage?.({ data: JSON.stringify({ type: 'PixelPlaced', at: { x: 2, y: 2 }, color: 7, seq: 2 }) });
    await nextTurn();
    expect(snapshotCalls).toBe(2);
    expect(client.buffer?.seq).toBe(2);
    expect(client.buffer?.colorAt(1, 1)).toBe(4);
    expect(client.buffer?.colorAt(2, 2)).toBe(-1); // gapped delta was already covered/rejected by the snapshot watermark
  });

  it('does not let an older REST placement response overwrite a newer WS state', async () => {
    const socket = fakeSocket();
    const client = new CanvasClient({
      fetchMeta: () => Promise.resolve(meta),
      fetchSnapshot: () => Promise.resolve(emptySnapshot),
      openSocket: () => socket,
      onUpdate: () => undefined,
    });
    const started = client.start();
    await nextTurn();
    acknowledge(socket);
    await started;
    socket.onmessage?.({ data: JSON.stringify({ type: 'PixelPlaced', at: { x: 1, y: 1 }, color: 8, seq: 1 }) });

    client.applyConfirmedPlacement({
      at: { x: 1, y: 1 },
      color: 2 as domain.ColorIndex,
      seq: 1 as domain.PerCanvasSequence,
      placedAt: '2026-01-01T00:00:00.000Z',
      cooldownMs: 300_000,
    }, 'canvas_1');
    expect(client.buffer?.colorAt(1, 1)).toBe(8);
  });

  it('reloads metadata and rejects old REST facts when an archived canvas rolls to a new term', async () => {
    const sockets: Array<ReturnType<typeof fakeSocket>> = [];
    const nextMeta: dto.CanvasMetaResponse = {
      id: 'canvas_2' as domain.CanvasId,
      term: 'S27',
      status: 'active',
      width: 2,
      height: 2,
      palette: 'default',
    };
    const metas = [meta, nextMeta];
    const snapshots: dto.CanvasSnapshotResponse[] = [
      emptySnapshot,
      { width: 2, height: 2, seq: 2 as domain.PerCanvasSequence, cells: [{ x: 1, y: 1, color: 6 as domain.ColorIndex }] },
    ];
    const client = new CanvasClient({
      fetchMeta: () => Promise.resolve(metas.shift() ?? nextMeta),
      fetchSnapshot: () => Promise.resolve(snapshots.shift() ?? snapshots[0]!),
      openSocket: () => {
        const socket = fakeSocket();
        sockets.push(socket);
        return socket;
      },
      onUpdate: () => undefined,
    });

    const started = client.start();
    await nextTurn();
    acknowledge(sockets[0]!);
    await started;
    sockets[0]?.onmessage?.({ data: JSON.stringify({ type: 'CanvasLifecycleChanged', status: 'archived', seq: 1 }) });
    await nextTurn();
    expect(sockets).toHaveLength(2);
    acknowledge(sockets[1]!, 'canvas_2');
    await nextTurn();
    await nextTurn();

    expect(sockets[1]?.sent[0]).toContain('canvas_2');
    expect(client.canvasId).toBe('canvas_2');
    expect(client.buffer?.width).toBe(2);
    expect(client.buffer?.height).toBe(2);
    expect(client.buffer?.colorAt(1, 1)).toBe(6);

    client.applyConfirmedPlacement({
      at: { x: 0, y: 0 },
      color: 9 as domain.ColorIndex,
      seq: 3 as domain.PerCanvasSequence,
      placedAt: '2026-06-29T00:00:00.000Z',
      cooldownMs: 0,
    }, 'canvas_1');
    expect(client.buffer?.colorAt(0, 0)).toBe(-1);
  });
});
