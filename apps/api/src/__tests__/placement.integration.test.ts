import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { domain } from '@quad/core';
import { createPrismaClient, createPlacementRepository } from '@quad/db';
import { InMemoryRealtimeBus } from '@quad/realtime';
import { buildApp } from '../app.js';
import { placePixel } from '../services/placement.js';
import type { PlacementDeps } from '../services/placement.js';
import { InMemorySessionStore } from '../auth/session-store.js';

// Requires the local Docker Compose Postgres, migrated (see vitest.integration.config.ts).
const DATABASE_URL = process.env['DATABASE_URL'] ?? 'postgresql://quad:quad@127.0.0.1:5432/quad';
const prisma = createPrismaClient({ connectionString: DATABASE_URL });
const repo = createPlacementRepository(prisma);

function deps(cooldownMs = 0, now: () => Date = () => new Date()): PlacementDeps {
  return { repo, cooldownMs, now, bus: new InMemoryRealtimeBus() };
}

async function reset(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "pixels","pixel_events","Canvas","Membership","User","Tenant" CASCADE',
  );
}

interface Seed {
  readonly tenantId: string;
  readonly userId: string;
  readonly canvasId: string;
}

async function seed(opts: {
  tenantId?: string;
  canvasStatus?: string;
  width?: number;
  height?: number;
  handle?: string;
  email?: string;
} = {}): Promise<Seed> {
  const tenantId = opts.tenantId ?? 'ten_test';
  const tenant = await prisma.tenant.create({
    data: { id: tenantId, slug: tenantId, publicTitle: 'Test University', status: 'active' },
  });
  const user = await prisma.user.create({
    data: {
      email: opts.email ?? `${tenantId}-user@example.edu`,
      publicHandle: opts.handle ?? 'tester',
      displayName: 'Tester',
      status: 'active',
    },
  });
  await prisma.membership.create({
    data: { tenantId: tenant.id, userId: user.id, role: 'participant', status: 'active' },
  });
  const canvas = await prisma.canvas.create({
    data: {
      tenantId: tenant.id,
      termLabel: 'F26',
      status: opts.canvasStatus ?? 'active',
      width: opts.width ?? 10,
      height: opts.height ?? 10,
    },
  });
  return { tenantId: tenant.id, userId: user.id, canvasId: canvas.id };
}

function principal(s: Seed): domain.Principal {
  return { userId: s.userId as domain.UserId, tenantId: s.tenantId as domain.TenantId, role: 'participant' };
}

beforeEach(reset);
afterAll(async () => {
  await prisma.$disconnect();
});

describe('placement service', () => {
  it('appends a PixelPlaced event and updates the projection', async () => {
    const s = await seed();
    const r = await placePixel(deps(), principal(s), { id: s.tenantId, palette: 'default' }, { x: 1, y: 2, color: 3, idempotencyKey: 'k1' });
    expect(r.ok).toBe(true);

    const events = await prisma.pixelEvent.findMany({ where: { canvasId: s.canvasId } });
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('PixelPlaced');
    expect(events[0]?.newColor).toBe(3);
    expect(events[0]?.seq).toBe(1);

    const pixel = await repo.getPixel(s.canvasId, 1, 2);
    expect(pixel?.color).toBe(3);
    expect(pixel?.ownerHandle).toBe('tester');
  });

  it('rejects an out-of-bounds coordinate', async () => {
    const s = await seed({ width: 5, height: 5 });
    const r = await placePixel(deps(), principal(s), { id: s.tenantId, palette: 'default' }, { x: 5, y: 0, color: 0, idempotencyKey: 'k' });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a color outside the tenant palette', async () => {
    const s = await seed();
    const r = await placePixel(deps(), principal(s), { id: s.tenantId, palette: 'default' }, { x: 0, y: 0, color: 999, idempotencyKey: 'k' });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects placement when there is no active canvas', async () => {
    const s = await seed({ canvasStatus: 'frozen' });
    const r = await placePixel(deps(), principal(s), { id: s.tenantId, palette: 'default' }, { x: 0, y: 0, color: 0, idempotencyKey: 'k' });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error.code).toBe('NOT_FOUND');
  });

  it('places on the active canvas even when a newer non-active canvas exists', async () => {
    const s = await seed({ canvasStatus: 'active' });
    await prisma.canvas.create({ data: { tenantId: s.tenantId, termLabel: 'S27', status: 'frozen', width: 10, height: 10 } });
    const r = await placePixel(deps(), principal(s), { id: s.tenantId, palette: 'default' }, { x: 0, y: 0, color: 0, idempotencyKey: 'k' });
    expect(r.ok).toBe(true);
    const events = await prisma.pixelEvent.findMany({ where: { canvasId: s.canvasId } });
    expect(events).toHaveLength(1);
  });

  it('rejects a placement during cooldown with COOLDOWN_ACTIVE', async () => {
    const s = await seed();
    const first = await placePixel(deps(60_000), principal(s), { id: s.tenantId, palette: 'default' }, { x: 0, y: 0, color: 0, idempotencyKey: 'k1' });
    expect(first.ok).toBe(true);
    const second = await placePixel(deps(60_000), principal(s), { id: s.tenantId, palette: 'default' }, { x: 1, y: 1, color: 1, idempotencyKey: 'k2' });
    expect(second.ok).toBe(false);
    expect(second.ok === false && second.error.code).toBe('COOLDOWN_ACTIVE');
    expect(second.ok === false && typeof second.error.details?.['retryAfterMs']).toBe('number');
  });

  it('idempotency replay returns the original result and appends one event', async () => {
    const s = await seed();
    const t = { id: s.tenantId, palette: 'default' };
    const r1 = await placePixel(deps(0), principal(s), t, { x: 1, y: 1, color: 2, idempotencyKey: 'dup' });
    expect(r1.ok).toBe(true);
    // Replay the SAME key with DIFFERENT params → returns the original placement, not the new one.
    const r2 = await placePixel(deps(0), principal(s), t, { x: 9, y: 9, color: 5, idempotencyKey: 'dup' });
    expect(r2.ok).toBe(true);
    expect(r2.ok && r2.result.at).toEqual({ x: 1, y: 1 });
    expect(r2.ok && r2.result.color).toBe(2);
    const events = await prisma.pixelEvent.findMany({ where: { canvasId: s.canvasId } });
    expect(events).toHaveLength(1);
  });

  it('enforces tenant isolation (cannot write another tenant)', async () => {
    const a = await seed({ tenantId: 'ten_a' });
    const b = await seed({ tenantId: 'ten_b' });
    await placePixel(deps(0), principal(a), { id: 'ten_a', palette: 'default' }, { x: 0, y: 0, color: 0, idempotencyKey: 'k' });

    const bEvents = await prisma.pixelEvent.findMany({ where: { tenantId: b.tenantId } });
    expect(bEvents).toHaveLength(0);
    const aEvents = await prisma.pixelEvent.findMany({ where: { tenantId: a.tenantId } });
    expect(aEvents).toHaveLength(1);
  });

  it('rejects a principal that does not match the resolved tenant', async () => {
    const a = await seed({ tenantId: 'ten_a' });
    await seed({ tenantId: 'ten_b' });
    const r = await placePixel(deps(0), principal(a), { id: 'ten_b', palette: 'default' }, { x: 0, y: 0, color: 0, idempotencyKey: 'k' });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error.code).toBe('TENANT_MISMATCH');
  });
});

describe('placement routes (HTTP)', () => {
  it('unknown host does not resolve to a tenant (no default)', async () => {
    const app = await buildApp({ placement: deps(0) });
    try {
      const res = await app.inject({ method: 'GET', url: '/api/v1/canvas/current/pixels/0/0', headers: { host: 'unknown.example' } });
      expect(res.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });

  it('write path rejects without an authenticated principal (401)', async () => {
    const app = await buildApp({ placement: deps(0) });
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/canvas/current/pixels',
        headers: { host: 'rutgers.localhost', 'idempotency-key': 'k', 'content-type': 'application/json' },
        payload: { at: { x: 0, y: 0 }, color: 0 },
      });
      expect(res.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it('reads a placed cell as DC2 only (no private email)', async () => {
    const s = await seed({ tenantId: 'ten_rutgers', handle: 'scarletKnight', email: 'private-dc3@scarletmail.rutgers.edu' });
    await placePixel(deps(0), principal(s), { id: 'ten_rutgers', palette: 'default' }, { x: 2, y: 3, color: 1, idempotencyKey: 'k' });

    const app = await buildApp({ placement: deps(0) });
    try {
      const res = await app.inject({ method: 'GET', url: '/api/v1/canvas/current/pixels/2/3', headers: { host: 'rutgers.localhost' } });
      expect(res.statusCode).toBe(200);
      const body = res.json() as { color: number; owner?: { handle: string } };
      expect(body.color).toBe(1);
      expect(body.owner?.handle).toBe('scarletKnight');
      expect(res.body).not.toContain('@scarletmail.rutgers.edu');
    } finally {
      await app.close();
    }
  });
});

describe('canvas read endpoints (HTTP)', () => {
  it('returns canvas metadata', async () => {
    await seed({ tenantId: 'ten_rutgers' });
    const app = await buildApp({ placement: deps(0) });
    try {
      const res = await app.inject({ method: 'GET', url: '/api/v1/canvas/current', headers: { host: 'rutgers.localhost' } });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ term: 'F26', status: 'active', width: 10, height: 10, palette: 'default' });
    } finally {
      await app.close();
    }
  });

  it('returns a snapshot reflecting placements', async () => {
    const s = await seed({ tenantId: 'ten_rutgers' });
    const t = { id: 'ten_rutgers', palette: 'default' };
    await placePixel(deps(0), principal(s), t, { x: 1, y: 1, color: 2, idempotencyKey: 'a' });
    await placePixel(deps(0), principal(s), t, { x: 4, y: 5, color: 3, idempotencyKey: 'b' });
    const app = await buildApp({ placement: deps(0) });
    try {
      const res = await app.inject({ method: 'GET', url: '/api/v1/canvas/current/snapshot', headers: { host: 'rutgers.localhost' } });
      expect(res.statusCode).toBe(200);
      const snap = res.json() as { width: number; seq: number; cells: { x: number; y: number; color: number }[] };
      expect(snap.width).toBe(10);
      expect(snap.seq).toBe(2);
      expect(snap.cells).toHaveLength(2);
      expect(snap.cells).toContainEqual({ x: 1, y: 1, color: 2 });
      expect(snap.cells).toContainEqual({ x: 4, y: 5, color: 3 });
    } finally {
      await app.close();
    }
  });

  it('serves reads for a non-active (frozen) canvas', async () => {
    const s = await seed({ tenantId: 'ten_rutgers', canvasStatus: 'active' });
    await placePixel(deps(0), principal(s), { id: 'ten_rutgers', palette: 'default' }, { x: 0, y: 0, color: 0, idempotencyKey: 'k' });
    await prisma.canvas.update({ where: { id: s.canvasId }, data: { status: 'frozen' } });
    const app = await buildApp({ placement: deps(0) });
    try {
      const meta = await app.inject({ method: 'GET', url: '/api/v1/canvas/current', headers: { host: 'rutgers.localhost' } });
      expect(meta.statusCode).toBe(200);
      expect((meta.json() as { status: string }).status).toBe('frozen');
      const snap = await app.inject({ method: 'GET', url: '/api/v1/canvas/current/snapshot', headers: { host: 'rutgers.localhost' } });
      expect(snap.statusCode).toBe(200);
      expect((snap.json() as { cells: unknown[] }).cells).toHaveLength(1);
    } finally {
      await app.close();
    }
  });

  it('returns per-cell history as DC2, paginated (oldest first)', async () => {
    const s = await seed({ tenantId: 'ten_rutgers', handle: 'historian', email: 'h-dc3@scarletmail.rutgers.edu' });
    const t = { id: 'ten_rutgers', palette: 'default' };
    await placePixel(deps(0), principal(s), t, { x: 0, y: 0, color: 0, idempotencyKey: 'h1' });
    await placePixel(deps(0), principal(s), t, { x: 0, y: 0, color: 1, idempotencyKey: 'h2' });
    await placePixel(deps(0), principal(s), t, { x: 0, y: 0, color: 2, idempotencyKey: 'h3' });
    const app = await buildApp({ placement: deps(0) });
    try {
      const res = await app.inject({ method: 'GET', url: '/api/v1/canvas/current/pixels/0/0/history?limit=2', headers: { host: 'rutgers.localhost' } });
      expect(res.statusCode).toBe(200);
      const page = res.json() as { data: { color: number; owner?: { handle: string } }[]; page: { nextCursor: string | null } };
      expect(page.data).toHaveLength(2);
      expect(page.data[0]?.color).toBe(0);
      expect(page.data[0]?.owner?.handle).toBe('historian');
      expect(page.page.nextCursor).not.toBeNull();
      expect(res.body).not.toContain('@scarletmail.rutgers.edu');

      const res2 = await app.inject({
        method: 'GET',
        url: `/api/v1/canvas/current/pixels/0/0/history?limit=2&cursor=${page.page.nextCursor}`,
        headers: { host: 'rutgers.localhost' },
      });
      const page2 = res2.json() as { data: { color: number }[]; page: { nextCursor: string | null } };
      expect(page2.data).toHaveLength(1);
      expect(page2.data[0]?.color).toBe(2);
      expect(page2.page.nextCursor).toBeNull();
    } finally {
      await app.close();
    }
  });

  it('unknown host gets no canvas metadata (404)', async () => {
    const app = await buildApp({ placement: deps(0) });
    try {
      const res = await app.inject({ method: 'GET', url: '/api/v1/canvas/current', headers: { host: 'unknown.example' } });
      expect(res.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });
});

describe('authenticated placement (HTTP)', () => {
  it('accepts a placement carrying a valid session cookie', async () => {
    const s = await seed({ tenantId: 'ten_rutgers' });
    const sessions = new InMemorySessionStore();
    const sessionId = await sessions.create({ userId: s.userId, tenantId: 'ten_rutgers' }, 3600);
    const app = await buildApp({ placement: deps(0), auth: { sessionStore: sessions } });
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/canvas/current/pixels',
        headers: {
          host: 'rutgers.localhost',
          'idempotency-key': 'k1',
          'content-type': 'application/json',
          cookie: `quad_session=${sessionId}`,
        },
        payload: { at: { x: 1, y: 1 }, color: 2 },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json() as { at: { x: number; y: number }; color: number };
      expect(body.at).toEqual({ x: 1, y: 1 });
      expect(body.color).toBe(2);
    } finally {
      await app.close();
    }
  });

  it('still rejects placement with no session (401)', async () => {
    await seed({ tenantId: 'ten_rutgers' });
    const app = await buildApp({ placement: deps(0), auth: { sessionStore: new InMemorySessionStore() } });
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/canvas/current/pixels',
        headers: { host: 'rutgers.localhost', 'idempotency-key': 'k', 'content-type': 'application/json' },
        payload: { at: { x: 0, y: 0 }, color: 0 },
      });
      expect(res.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it('rejects a session whose user has no active membership (401)', async () => {
    await prisma.tenant.create({ data: { id: 'ten_rutgers', slug: 'rutgers', publicTitle: 'Test', status: 'active' } });
    const user = await prisma.user.create({
      data: { email: 'nomember@scarletmail.rutgers.edu', publicHandle: 'nm', displayName: 'NM', status: 'active' },
    });
    await prisma.canvas.create({ data: { tenantId: 'ten_rutgers', termLabel: 'F26', status: 'active', width: 10, height: 10 } });
    const sessions = new InMemorySessionStore();
    const sessionId = await sessions.create({ userId: user.id, tenantId: 'ten_rutgers' }, 3600);
    const app = await buildApp({ placement: deps(0), auth: { sessionStore: sessions } });
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/canvas/current/pixels',
        headers: {
          host: 'rutgers.localhost',
          'idempotency-key': 'k',
          'content-type': 'application/json',
          cookie: `quad_session=${sessionId}`,
        },
        payload: { at: { x: 0, y: 0 }, color: 0 },
      });
      expect(res.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });
});
