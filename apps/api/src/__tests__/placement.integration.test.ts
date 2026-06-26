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

describe('session reflection (HTTP)', () => {
  it('reflects the authenticated identity (DC2 only)', async () => {
    const s = await seed({ tenantId: 'ten_rutgers', handle: 'scarlet', email: 'private@scarletmail.rutgers.edu' });
    const sessions = new InMemorySessionStore();
    const sessionId = await sessions.create({ userId: s.userId, tenantId: 'ten_rutgers' }, 3600);
    const app = await buildApp({ placement: deps(0), auth: { sessionStore: sessions } });
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/session',
        headers: { host: 'rutgers.localhost', cookie: `quad_session=${sessionId}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as { authenticated: boolean; user?: { handle: string }; role?: string };
      expect(body.authenticated).toBe(true);
      expect(body.user?.handle).toBe('scarlet');
      expect(body.role).toBe('participant');
      expect(res.body).not.toContain('@'); // no DC3 email
    } finally {
      await app.close();
    }
  });

  it('reflects anonymous when there is no session', async () => {
    const app = await buildApp({ placement: deps(0), auth: { sessionStore: new InMemorySessionStore() } });
    try {
      const res = await app.inject({ method: 'GET', url: '/api/v1/session', headers: { host: 'rutgers.localhost' } });
      expect(res.statusCode).toBe(200);
      expect((res.json() as { authenticated: boolean }).authenticated).toBe(false);
    } finally {
      await app.close();
    }
  });

  it('returns 404 for an unknown host (no tenant)', async () => {
    const app = await buildApp({ placement: deps(0), auth: { sessionStore: new InMemorySessionStore() } });
    try {
      const res = await app.inject({ method: 'GET', url: '/api/v1/session', headers: { host: 'unknown.example' } });
      expect(res.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });
});

describe('moderation actions (HTTP)', () => {
  it('a moderator suspends a member: audited, sessions revoked, access cut', async () => {
    await prisma.tenant.create({ data: { id: 'ten_rutgers', slug: 'rutgers', publicTitle: 'R', status: 'active' } });
    await prisma.canvas.create({ data: { tenantId: 'ten_rutgers', termLabel: 'F26', status: 'active', width: 10, height: 10 } });
    const mod = await prisma.user.create({ data: { email: 'mod@scarletmail.rutgers.edu', publicHandle: 'mod', status: 'active' } });
    await prisma.membership.create({ data: { tenantId: 'ten_rutgers', userId: mod.id, role: 'moderator', status: 'active' } });
    const target = await prisma.user.create({ data: { email: 'target@scarletmail.rutgers.edu', publicHandle: 'target', status: 'active' } });
    await prisma.membership.create({ data: { tenantId: 'ten_rutgers', userId: target.id, role: 'participant', status: 'active' } });

    const sessions = new InMemorySessionStore();
    const modSession = await sessions.create({ userId: mod.id, tenantId: 'ten_rutgers' }, 3600);
    const targetSession = await sessions.create({ userId: target.id, tenantId: 'ten_rutgers' }, 3600);
    const app = await buildApp({ placement: deps(0), auth: { sessionStore: sessions } });
    try {
      const before = await app.inject({
        method: 'POST',
        url: '/api/v1/canvas/current/pixels',
        headers: { host: 'rutgers.localhost', 'idempotency-key': 't1', 'content-type': 'application/json', cookie: `quad_session=${targetSession}` },
        payload: { at: { x: 0, y: 0 }, color: 0 },
      });
      expect(before.statusCode).toBe(201);

      const action = await app.inject({
        method: 'POST',
        url: '/api/v1/moderation/actions',
        headers: { host: 'rutgers.localhost', 'content-type': 'application/json', cookie: `quad_session=${modSession}` },
        payload: { actionType: 'suspend_member', targetRef: target.id, reason: 'spam' },
      });
      expect(action.statusCode).toBe(200);
      const audits = await prisma.moderationAction.findMany({ where: { tenantId: 'ten_rutgers' } });
      expect(audits).toHaveLength(1);
      expect(audits[0]?.actionType).toBe('suspend_member');

      const after = await app.inject({
        method: 'POST',
        url: '/api/v1/canvas/current/pixels',
        headers: { host: 'rutgers.localhost', 'idempotency-key': 't2', 'content-type': 'application/json', cookie: `quad_session=${targetSession}` },
        payload: { at: { x: 1, y: 1 }, color: 1 },
      });
      expect(after.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it('rejects a non-moderator (403)', async () => {
    const s = await seed({ tenantId: 'ten_rutgers' });
    const sessions = new InMemorySessionStore();
    const sid = await sessions.create({ userId: s.userId, tenantId: 'ten_rutgers' }, 3600);
    const app = await buildApp({ placement: deps(0), auth: { sessionStore: sessions } });
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/moderation/actions',
        headers: { host: 'rutgers.localhost', 'content-type': 'application/json', cookie: `quad_session=${sid}` },
        payload: { actionType: 'suspend_member', targetRef: 'whoever' },
      });
      expect(res.statusCode).toBe(403);
    } finally {
      await app.close();
    }
  });

  it('rejects an unauthenticated request (401)', async () => {
    await seed({ tenantId: 'ten_rutgers' });
    const app = await buildApp({ placement: deps(0), auth: { sessionStore: new InMemorySessionStore() } });
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/moderation/actions',
        headers: { host: 'rutgers.localhost', 'content-type': 'application/json' },
        payload: { actionType: 'suspend_member', targetRef: 'whoever' },
      });
      expect(res.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  async function seedModerator(): Promise<{ app: Awaited<ReturnType<typeof buildApp>>; cookie: string }> {
    await prisma.tenant.create({ data: { id: 'ten_rutgers', slug: 'rutgers', publicTitle: 'R', status: 'active' } });
    const mod = await prisma.user.create({ data: { email: 'm@scarletmail.rutgers.edu', publicHandle: 'm', status: 'active' } });
    await prisma.membership.create({ data: { tenantId: 'ten_rutgers', userId: mod.id, role: 'moderator', status: 'active' } });
    const sessions = new InMemorySessionStore();
    const sid = await sessions.create({ userId: mod.id, tenantId: 'ten_rutgers' }, 3600);
    const app = await buildApp({ placement: deps(0), auth: { sessionStore: sessions } });
    return { app, cookie: `quad_session=${sid}` };
  }

  it('requires a reason (422)', async () => {
    const { app, cookie } = await seedModerator();
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/moderation/actions',
        headers: { host: 'rutgers.localhost', 'content-type': 'application/json', cookie },
        payload: { actionType: 'suspend_member', targetRef: 'whoever' },
      });
      expect(res.statusCode).toBe(422);
    } finally {
      await app.close();
    }
  });

  it('a moderator cannot ban — ban requires admin (403)', async () => {
    const { app, cookie } = await seedModerator();
    try {
      const target = await prisma.user.create({ data: { email: 't@scarletmail.rutgers.edu', publicHandle: 't', status: 'active' } });
      await prisma.membership.create({ data: { tenantId: 'ten_rutgers', userId: target.id, role: 'participant', status: 'active' } });
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/moderation/actions',
        headers: { host: 'rutgers.localhost', 'content-type': 'application/json', cookie },
        payload: { actionType: 'ban_member', targetRef: target.id, reason: 'x' },
      });
      expect(res.statusCode).toBe(403);
    } finally {
      await app.close();
    }
  });
});

describe('admin role assignment (HTTP)', () => {
  async function seedAdmin(): Promise<{ app: Awaited<ReturnType<typeof buildApp>>; cookie: string; sessions: InMemorySessionStore }> {
    await prisma.tenant.create({ data: { id: 'ten_rutgers', slug: 'rutgers', publicTitle: 'R', status: 'active' } });
    const admin = await prisma.user.create({ data: { email: 'a@scarletmail.rutgers.edu', publicHandle: 'a', status: 'active' } });
    await prisma.membership.create({ data: { tenantId: 'ten_rutgers', userId: admin.id, role: 'admin', status: 'active' } });
    const sessions = new InMemorySessionStore();
    const sid = await sessions.create({ userId: admin.id, tenantId: 'ten_rutgers' }, 3600);
    const app = await buildApp({ placement: deps(0), auth: { sessionStore: sessions } });
    return { app, cookie: `quad_session=${sid}`, sessions };
  }

  it('an admin promotes a member, audited, and rotates their session', async () => {
    const { app, cookie, sessions } = await seedAdmin();
    try {
      const target = await prisma.user.create({ data: { email: 'p@scarletmail.rutgers.edu', publicHandle: 'p', status: 'active' } });
      await prisma.membership.create({ data: { tenantId: 'ten_rutgers', userId: target.id, role: 'participant', status: 'active' } });
      const targetSession = await sessions.create({ userId: target.id, tenantId: 'ten_rutgers' }, 3600);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/roster/roles',
        headers: { host: 'rutgers.localhost', 'content-type': 'application/json', cookie },
        payload: { targetRef: target.id, role: 'moderator' },
      });
      expect(res.statusCode).toBe(200);
      const membership = await prisma.membership.findFirst({ where: { tenantId: 'ten_rutgers', userId: target.id } });
      expect(membership?.role).toBe('moderator');
      expect(await sessions.get(targetSession)).toBeNull(); // privilege change rotated the session
      const audits = await prisma.moderationAction.findMany({ where: { actionType: 'assign_role' } });
      expect(audits).toHaveLength(1);
    } finally {
      await app.close();
    }
  });

  it('rejects a non-admin (403)', async () => {
    await prisma.tenant.create({ data: { id: 'ten_rutgers', slug: 'rutgers', publicTitle: 'R', status: 'active' } });
    const mod = await prisma.user.create({ data: { email: 'm@scarletmail.rutgers.edu', publicHandle: 'm', status: 'active' } });
    await prisma.membership.create({ data: { tenantId: 'ten_rutgers', userId: mod.id, role: 'moderator', status: 'active' } });
    const sessions = new InMemorySessionStore();
    const sid = await sessions.create({ userId: mod.id, tenantId: 'ten_rutgers' }, 3600);
    const app = await buildApp({ placement: deps(0), auth: { sessionStore: sessions } });
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/roster/roles',
        headers: { host: 'rutgers.localhost', 'content-type': 'application/json', cookie: `quad_session=${sid}` },
        payload: { targetRef: 'x', role: 'moderator' },
      });
      expect(res.statusCode).toBe(403);
    } finally {
      await app.close();
    }
  });

  it('rejects a non-tenant role like operator (422)', async () => {
    const { app, cookie } = await seedAdmin();
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/roster/roles',
        headers: { host: 'rutgers.localhost', 'content-type': 'application/json', cookie },
        payload: { targetRef: 'x', role: 'operator' },
      });
      expect(res.statusCode).toBe(422);
    } finally {
      await app.close();
    }
  });

  it('does not rotate sessions or audit for a no-op (same role)', async () => {
    const { app, cookie, sessions } = await seedAdmin();
    try {
      const target = await prisma.user.create({ data: { email: 'q@scarletmail.rutgers.edu', publicHandle: 'q', status: 'active' } });
      await prisma.membership.create({ data: { tenantId: 'ten_rutgers', userId: target.id, role: 'participant', status: 'active' } });
      const targetSession = await sessions.create({ userId: target.id, tenantId: 'ten_rutgers' }, 3600);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/roster/roles',
        headers: { host: 'rutgers.localhost', 'content-type': 'application/json', cookie },
        payload: { targetRef: target.id, role: 'participant' },
      });
      expect(res.statusCode).toBe(200);
      expect(await sessions.get(targetSession)).not.toBeNull(); // unchanged role → session NOT rotated
      const audits = await prisma.moderationAction.findMany({ where: { actionType: 'assign_role' } });
      expect(audits).toHaveLength(0); // no-op → no audit
    } finally {
      await app.close();
    }
  });

  it('lists the roster as DC2 for an admin', async () => {
    const { app, cookie } = await seedAdmin();
    try {
      const p = await prisma.user.create({ data: { email: 'rosterp@scarletmail.rutgers.edu', publicHandle: 'rosterp', status: 'active' } });
      await prisma.membership.create({ data: { tenantId: 'ten_rutgers', userId: p.id, role: 'participant', status: 'active' } });
      const res = await app.inject({ method: 'GET', url: '/api/v1/admin/roster', headers: { host: 'rutgers.localhost', cookie } });
      expect(res.statusCode).toBe(200);
      const body = res.json() as { data: Array<{ userId: string; handle?: string; role: string }> };
      expect(body.data.length).toBeGreaterThanOrEqual(2);
      expect(body.data.map((m) => m.handle)).toContain('rosterp');
      expect(res.body).not.toContain('@'); // no DC3 email
    } finally {
      await app.close();
    }
  });

  it('rejects roster listing for a non-admin (403)', async () => {
    const s = await seed({ tenantId: 'ten_rutgers' });
    const sessions = new InMemorySessionStore();
    const sid = await sessions.create({ userId: s.userId, tenantId: 'ten_rutgers' }, 3600);
    const app = await buildApp({ placement: deps(0), auth: { sessionStore: sessions } });
    try {
      const res = await app.inject({ method: 'GET', url: '/api/v1/admin/roster', headers: { host: 'rutgers.localhost', cookie: `quad_session=${sid}` } });
      expect(res.statusCode).toBe(403);
    } finally {
      await app.close();
    }
  });

  it('an admin freezes the canvas: status + audit, and placement stops', async () => {
    const { app, cookie, sessions } = await seedAdmin();
    try {
      await prisma.canvas.create({ data: { tenantId: 'ten_rutgers', termLabel: 'F26', status: 'active', width: 10, height: 10 } });
      const p = await prisma.user.create({ data: { email: 'pp@scarletmail.rutgers.edu', publicHandle: 'pp', status: 'active' } });
      await prisma.membership.create({ data: { tenantId: 'ten_rutgers', userId: p.id, role: 'participant', status: 'active' } });
      const pSession = await sessions.create({ userId: p.id, tenantId: 'ten_rutgers' }, 3600);

      const before = await app.inject({
        method: 'POST',
        url: '/api/v1/canvas/current/pixels',
        headers: { host: 'rutgers.localhost', 'idempotency-key': 'lc1', 'content-type': 'application/json', cookie: `quad_session=${pSession}` },
        payload: { at: { x: 0, y: 0 }, color: 0 },
      });
      expect(before.statusCode).toBe(201);

      const frozen = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/canvas/lifecycle',
        headers: { host: 'rutgers.localhost', 'content-type': 'application/json', cookie },
        payload: { status: 'frozen' },
      });
      expect(frozen.statusCode).toBe(200);
      expect((frozen.json() as { status: string }).status).toBe('frozen');
      const audits = await prisma.moderationAction.findMany({ where: { actionType: 'canvas_lifecycle' } });
      expect(audits).toHaveLength(1);

      const after = await app.inject({
        method: 'POST',
        url: '/api/v1/canvas/current/pixels',
        headers: { host: 'rutgers.localhost', 'idempotency-key': 'lc2', 'content-type': 'application/json', cookie: `quad_session=${pSession}` },
        payload: { at: { x: 1, y: 1 }, color: 1 },
      });
      expect(after.statusCode).toBe(404); // no active canvas → placement rejected
    } finally {
      await app.close();
    }
  });

  it('returns the tenant config for an admin (config/DC2 only)', async () => {
    const { app, cookie } = await seedAdmin();
    try {
      const res = await app.inject({ method: 'GET', url: '/api/v1/admin/tenant/config', headers: { host: 'rutgers.localhost', cookie } });
      expect(res.statusCode).toBe(200);
      const body = res.json() as { slug: string; palette: string; domains: string[] };
      expect(body.slug).toBe('rutgers');
      expect(body.palette).toBe('default');
      expect(body.domains).toContain('scarletmail.rutgers.edu');
    } finally {
      await app.close();
    }
  });

  it('rejects tenant config for a non-admin (403)', async () => {
    const s = await seed({ tenantId: 'ten_rutgers' });
    const sessions = new InMemorySessionStore();
    const sid = await sessions.create({ userId: s.userId, tenantId: 'ten_rutgers' }, 3600);
    const app = await buildApp({ placement: deps(0), auth: { sessionStore: sessions } });
    try {
      const res = await app.inject({ method: 'GET', url: '/api/v1/admin/tenant/config', headers: { host: 'rutgers.localhost', cookie: `quad_session=${sid}` } });
      expect(res.statusCode).toBe(403);
    } finally {
      await app.close();
    }
  });
});

describe('reports queue (HTTP)', () => {
  it('a participant files a report; a moderator sees it in the queue', async () => {
    await prisma.tenant.create({ data: { id: 'ten_rutgers', slug: 'rutgers', publicTitle: 'R', status: 'active' } });
    await prisma.canvas.create({ data: { tenantId: 'ten_rutgers', termLabel: 'F26', status: 'active', width: 10, height: 10 } });
    const reporter = await prisma.user.create({ data: { email: 'r@scarletmail.rutgers.edu', publicHandle: 'r', status: 'active' } });
    await prisma.membership.create({ data: { tenantId: 'ten_rutgers', userId: reporter.id, role: 'participant', status: 'active' } });
    const mod = await prisma.user.create({ data: { email: 'mod2@scarletmail.rutgers.edu', publicHandle: 'mod2', status: 'active' } });
    await prisma.membership.create({ data: { tenantId: 'ten_rutgers', userId: mod.id, role: 'moderator', status: 'active' } });

    const sessions = new InMemorySessionStore();
    const reporterSession = await sessions.create({ userId: reporter.id, tenantId: 'ten_rutgers' }, 3600);
    const modSession = await sessions.create({ userId: mod.id, tenantId: 'ten_rutgers' }, 3600);
    const app = await buildApp({ placement: deps(0), auth: { sessionStore: sessions } });
    try {
      const filed = await app.inject({
        method: 'POST',
        url: '/api/v1/reports',
        headers: { host: 'rutgers.localhost', 'content-type': 'application/json', cookie: `quad_session=${reporterSession}` },
        payload: { targetRef: 'pixel:3,4', reason: 'offensive' },
      });
      expect(filed.statusCode).toBe(201);

      const queue = await app.inject({
        method: 'GET',
        url: '/api/v1/moderation/reports',
        headers: { host: 'rutgers.localhost', cookie: `quad_session=${modSession}` },
      });
      expect(queue.statusCode).toBe(200);
      const body = queue.json() as { data: Array<{ targetRef: string; reason: string; status: string }> };
      expect(body.data).toHaveLength(1);
      expect(body.data[0]).toMatchObject({ targetRef: 'pixel:3,4', reason: 'offensive', status: 'open' });
    } finally {
      await app.close();
    }
  });

  it('rejects anonymous report filing (401)', async () => {
    await prisma.tenant.create({ data: { id: 'ten_rutgers', slug: 'rutgers', publicTitle: 'R', status: 'active' } });
    const app = await buildApp({ placement: deps(0), auth: { sessionStore: new InMemorySessionStore() } });
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/reports',
        headers: { host: 'rutgers.localhost', 'content-type': 'application/json' },
        payload: { targetRef: 'x', reason: 'y' },
      });
      expect(res.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it('rejects a non-moderator listing the queue (403)', async () => {
    const s = await seed({ tenantId: 'ten_rutgers' });
    const sessions = new InMemorySessionStore();
    const sid = await sessions.create({ userId: s.userId, tenantId: 'ten_rutgers' }, 3600);
    const app = await buildApp({ placement: deps(0), auth: { sessionStore: sessions } });
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/moderation/reports',
        headers: { host: 'rutgers.localhost', cookie: `quad_session=${sid}` },
      });
      expect(res.statusCode).toBe(403);
    } finally {
      await app.close();
    }
  });

  it('a moderator resolves a report (status transition + audit)', async () => {
    await prisma.tenant.create({ data: { id: 'ten_rutgers', slug: 'rutgers', publicTitle: 'R', status: 'active' } });
    await prisma.canvas.create({ data: { tenantId: 'ten_rutgers', termLabel: 'F26', status: 'active', width: 10, height: 10 } });
    const reporter = await prisma.user.create({ data: { email: 'r3@scarletmail.rutgers.edu', publicHandle: 'r3', status: 'active' } });
    await prisma.membership.create({ data: { tenantId: 'ten_rutgers', userId: reporter.id, role: 'participant', status: 'active' } });
    const mod = await prisma.user.create({ data: { email: 'mod3@scarletmail.rutgers.edu', publicHandle: 'mod3', status: 'active' } });
    await prisma.membership.create({ data: { tenantId: 'ten_rutgers', userId: mod.id, role: 'moderator', status: 'active' } });

    const sessions = new InMemorySessionStore();
    const reporterSession = await sessions.create({ userId: reporter.id, tenantId: 'ten_rutgers' }, 3600);
    const modSession = await sessions.create({ userId: mod.id, tenantId: 'ten_rutgers' }, 3600);
    const app = await buildApp({ placement: deps(0), auth: { sessionStore: sessions } });
    try {
      const filed = await app.inject({
        method: 'POST',
        url: '/api/v1/reports',
        headers: { host: 'rutgers.localhost', 'content-type': 'application/json', cookie: `quad_session=${reporterSession}` },
        payload: { targetRef: 'pixel:1,1', reason: 'bad' },
      });
      const reportId = (filed.json() as { id: string }).id;

      const resolved = await app.inject({
        method: 'POST',
        url: '/api/v1/moderation/actions',
        headers: { host: 'rutgers.localhost', 'content-type': 'application/json', cookie: `quad_session=${modSession}` },
        payload: { actionType: 'resolve_report', targetRef: reportId, reason: 'handled' },
      });
      expect(resolved.statusCode).toBe(200);
      const report = await prisma.report.findFirst({ where: { id: reportId } });
      expect(report?.status).toBe('resolved');
      const audits = await prisma.moderationAction.findMany({ where: { actionType: 'resolve_report' } });
      expect(audits).toHaveLength(1);
    } finally {
      await app.close();
    }
  });
});
