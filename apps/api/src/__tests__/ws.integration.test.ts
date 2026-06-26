import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { createPrismaClient, createPlacementRepository } from '@quad/db';
import { buildApp } from '../app.js';
import type { PlacementDeps } from '../services/placement.js';

const DATABASE_URL = process.env['DATABASE_URL'] ?? 'postgresql://quad:quad@127.0.0.1:5432/quad';
const prisma = createPrismaClient({ connectionString: DATABASE_URL });
const repo = createPlacementRepository(prisma);
const deps: PlacementDeps = { repo, cooldownMs: 0, now: () => new Date() };

async function reset(): Promise<void> {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "pixels","pixel_events","Canvas","Membership","User","Tenant" CASCADE');
}

async function seedCanvas(tenantId = 'ten_rutgers'): Promise<string> {
  await prisma.tenant.create({ data: { id: tenantId, slug: tenantId, publicTitle: 'Test University', status: 'active' } });
  const canvas = await prisma.canvas.create({
    data: { tenantId, termLabel: 'F26', status: 'active', width: 10, height: 10 },
  });
  return canvas.id;
}

interface WsMessage {
  readonly type: string;
  readonly code?: string;
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
function connect(port: number, host = 'rutgers.localhost'): Promise<Conn> {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/api/v1/canvas/current/ws`, { headers: { host } });
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
  it('accepts a tenant-scoped connection and acknowledges a subscription', async () => {
    const canvasId = await seedCanvas();
    const app = await buildApp({ placement: deps });
    const port = await listen(app);
    const { socket, next } = await connect(port);
    try {
      socket.send(JSON.stringify({ type: 'SubscribeCanvas', canvasId }));
      const msg = await next();
      expect(msg.type).toBe('Heartbeat');
    } finally {
      socket.close();
      await app.close();
    }
  });

  it('rejects an unknown host with WS_TENANT_MISMATCH', async () => {
    const app = await buildApp({ placement: deps });
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

  it('rejects subscribing to a canvas outside the tenant', async () => {
    await seedCanvas();
    const app = await buildApp({ placement: deps });
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
});
