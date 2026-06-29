import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';
import type { domain } from '@quad/core';
import { createPrismaClient, createPlacementRepository } from '@quad/db';
import { InMemoryRealtimeBus, type RealtimeBus } from '@quad/realtime';
import { buildApp } from '../app.js';
import { placePixel } from '../services/placement.js';
import type { PlacementDeps } from '../services/placement.js';

const DATABASE_URL = process.env['DATABASE_URL'] ?? 'postgresql://quad:quad@127.0.0.1:5432/quad';
const prisma = createPrismaClient({ connectionString: DATABASE_URL });
const repo = createPlacementRepository(prisma);

function makeDeps(bus: RealtimeBus = new InMemoryRealtimeBus()): PlacementDeps {
  return { repo, cooldownMs: 0, now: () => new Date(), bus };
}

async function reset(): Promise<void> {
  await prisma.$executeRawUnsafe('ALTER TABLE "pixel_events" DISABLE TRIGGER USER');
  await prisma.$executeRawUnsafe('ALTER TABLE "moderation_actions" DISABLE TRIGGER USER');
  try {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "pixels","pixel_events","Canvas","Membership","User","Tenant" CASCADE');
  } finally {
    await prisma.$executeRawUnsafe('ALTER TABLE "pixel_events" ENABLE TRIGGER USER');
    await prisma.$executeRawUnsafe('ALTER TABLE "moderation_actions" ENABLE TRIGGER USER');
  }
}

async function seedCanvas(tenantId = 'ten_rutgers'): Promise<string> {
  await prisma.tenant.create({ data: { id: tenantId, slug: tenantId, publicTitle: 'Test University', status: 'active' } });
  const canvas = await prisma.canvas.create({
    data: { tenantId, termLabel: 'F26', status: 'active', width: 10, height: 10 },
  });
  return canvas.id;
}

async function seedPlacer(tenantId = 'ten_rutgers'): Promise<{ tenantId: string; userId: string; canvasId: string }> {
  await prisma.tenant.create({ data: { id: tenantId, slug: tenantId, publicTitle: 'Test University', status: 'active' } });
  const user = await prisma.user.create({
    data: { email: `${tenantId}-placer@example.edu`, publicHandle: 'placer', displayName: 'Placer', status: 'active' },
  });
  await prisma.membership.create({ data: { tenantId, userId: user.id, role: 'participant', status: 'active' } });
  const canvas = await prisma.canvas.create({
    data: { tenantId, termLabel: 'F26', status: 'active', width: 10, height: 10 },
  });
  return { tenantId, userId: user.id, canvasId: canvas.id };
}

interface WsMessage {
  readonly type: string;
  readonly code?: string;
  readonly approximateActive?: number;
  readonly canvasId?: string;
}

interface Conn {
  readonly socket: WebSocket;
  readonly next: () => Promise<WsMessage>;
}

async function listen(app: Awaited<ReturnType<typeof buildApp>>): Promise<number> {
  await app.listen({ port: 0, host: '127.0.0.1' });
  const addr = app.server.address();
  return typeof addr === 'object' && addr ? addr.port : 0;
}

// Queue messages from the moment the socket is created — so an early server message (e.g. an
// immediate error before close) is never missed by a late listener.
function connect(port: number, host = 'rutgers.localhost', origin: string | null = `http://${host}`): Promise<Conn> {
  const headers: Record<string, string> = { host };
  if (origin) headers['origin'] = origin;
  const socket = new WebSocket(`ws://127.0.0.1:${port}/api/v1/canvas/current/ws`, { headers });
  const queue: WsMessage[] = [];
  const waiters: Array<(m: WsMessage) => void> = [];
  socket.on('message', (data) => {
    const msg = JSON.parse(data.toString()) as WsMessage;
    const waiter = waiters.shift();
    if (waiter) waiter(msg);
    else queue.push(msg);
  });
  const next = (): Promise<WsMessage> =>
    new Promise((resolve) => {
      const queued = queue.shift();
      if (queued) resolve(queued);
      else waiters.push(resolve);
    });
  return new Promise((resolve, reject) => {
    socket.once('open', () => resolve({ socket, next }));
    socket.once('error', reject);
  });
}

beforeEach(reset);
afterAll(async () => {
  await prisma.$disconnect();
});

describe('websocket server', () => {
  it('registers the WebSocket server close lifecycle exactly once without listener warnings', async () => {
    const warnings: Error[] = [];
    const onWarning = (warning: Error): void => {
      if (warning.name === 'MaxListenersExceededWarning') warnings.push(warning);
    };
    process.on('warning', onWarning);

    const app = await buildApp({ placement: makeDeps() });
    await app.ready();
    const closeSpy = vi.spyOn(app.websocketServer, 'close');
    let closeCalls = 0;
    try {
      await app.close();
      // Node emits process warnings on a later turn than the listener addition that created them.
      await new Promise<void>((resolve) => setImmediate(resolve));
    } finally {
      closeCalls = closeSpy.mock.calls.length;
      process.off('warning', onWarning);
      closeSpy.mockRestore();
    }

    expect(closeCalls).toBe(1);
    expect(warnings).toEqual([]);
  });

  it('accepts a tenant-scoped connection and acknowledges a subscription', async () => {
    const canvasId = await seedCanvas();
    const app = await buildApp({ placement: makeDeps() });
    const port = await listen(app);
    const { socket, next } = await connect(port);
    try {
      socket.send(JSON.stringify({ type: 'SubscribeCanvas', canvasId }));
      const msg = await next();
      expect(msg).toMatchObject({ type: 'CanvasSubscribed', canvasId });
    } finally {
      socket.close();
      await app.close();
    }
  });

  it('rejects an unknown host with WS_TENANT_MISMATCH', async () => {
    const app = await buildApp({ placement: makeDeps() });
    const port = await listen(app);
    const { socket, next } = await connect(port, 'unknown.example');
    try {
      const msg = await next();
      expect(msg.type).toBe('Error');
      expect(msg.code).toBe('WS_TENANT_MISMATCH');
    } finally {
      socket.close();
      await app.close();
    }
  });

  it('rejects a connection whose Origin does not resolve to the request tenant', async () => {
    const app = await buildApp({ placement: makeDeps() });
    const port = await listen(app);
    const { socket, next } = await connect(port, 'rutgers.localhost', 'https://evil.example');
    try {
      expect(await next()).toMatchObject({ type: 'Error', code: 'WS_FORBIDDEN' });
    } finally {
      socket.close();
      await app.close();
    }
  });

  it('rejects malformed protocol messages instead of trusting a TypeScript cast', async () => {
    const app = await buildApp({ placement: makeDeps() });
    const port = await listen(app);
    const { socket, next } = await connect(port);
    try {
      socket.send(JSON.stringify({ type: 'SubscribeCanvas' }));
      expect(await next()).toMatchObject({ type: 'Error', code: 'WS_PROTOCOL_ERROR' });
    } finally {
      socket.close();
      await app.close();
    }
  });

  it('closes a connection that exceeds its inbound message budget', async () => {
    const app = await buildApp({ placement: makeDeps() });
    const port = await listen(app);
    const { socket, next } = await connect(port);
    try {
      for (let index = 0; index <= 120; index += 1) socket.send(JSON.stringify({ type: 'Pong' }));
      expect(await next()).toMatchObject({ type: 'Error', code: 'WS_RATE_LIMITED' });
    } finally {
      socket.close();
      await app.close();
    }
  });

  it('rejects subscribing to a canvas outside the tenant', async () => {
    await seedCanvas();
    const app = await buildApp({ placement: makeDeps() });
    const port = await listen(app);
    const { socket, next } = await connect(port);
    try {
      socket.send(JSON.stringify({ type: 'SubscribeCanvas', canvasId: 'canvas_other' }));
      const msg = await next();
      expect(msg.type).toBe('Error');
      expect(msg.code).toBe('WS_FORBIDDEN');
    } finally {
      socket.close();
      await app.close();
    }
  });

  it('broadcasts a placement to subscribed clients (fan-out)', async () => {
    const seed = await seedPlacer();
    const bus = new InMemoryRealtimeBus();
    const deps = makeDeps(bus);
    const app = await buildApp({ placement: deps });
    const port = await listen(app);
    const { socket, next } = await connect(port);
    try {
      socket.send(JSON.stringify({ type: 'SubscribeCanvas', canvasId: seed.canvasId }));
      expect(await next()).toMatchObject({ type: 'CanvasSubscribed', canvasId: seed.canvasId });

      const principal: domain.Principal = {
        userId: seed.userId as domain.UserId,
        tenantId: seed.tenantId as domain.TenantId,
        role: 'participant',
      };
      const result = await placePixel(
        deps,
        principal,
        { id: seed.tenantId, palette: 'default' },
        { x: 3, y: 4, color: 2, idempotencyKey: 'k1' },
      );
      expect(result.ok).toBe(true);

      let msg = await next();
      while (msg.type !== 'PixelPlaced') msg = await next(); // skip the presence broadcast / heartbeats
      expect(msg.type).toBe('PixelPlaced');
    } finally {
      socket.close();
      await app.close();
    }
  });

  it('reports presence on subscribe and answers PresencePing', async () => {
    const canvasId = await seedCanvas();
    const app = await buildApp({ placement: makeDeps() });
    const port = await listen(app);
    const { socket, next } = await connect(port);
    try {
      socket.send(JSON.stringify({ type: 'SubscribeCanvas', canvasId }));
      expect(await next()).toMatchObject({ type: 'CanvasSubscribed', canvasId });
      const presence = await next();
      expect(presence.type).toBe('PresenceUpdated');
      expect(presence.approximateActive).toBe(1);

      socket.send(JSON.stringify({ type: 'PresencePing' }));
      const pinged = await next();
      expect(pinged.type).toBe('PresenceUpdated');
      expect(pinged.approximateActive).toBe(1);
    } finally {
      socket.close();
      await app.close();
    }
  });
});
