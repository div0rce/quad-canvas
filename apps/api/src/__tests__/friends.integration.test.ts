import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createPrismaClient, createPlacementRepository } from '@quad/db';

const DATABASE_URL = process.env['DATABASE_URL'] ?? 'postgresql://quad:quad@127.0.0.1:5432/quad';
const prisma = createPrismaClient({ connectionString: DATABASE_URL });
const repo = createPlacementRepository(prisma);

async function reset(): Promise<void> {
  await prisma.$executeRawUnsafe('ALTER TABLE "pixel_events" DISABLE TRIGGER USER');
  await prisma.$executeRawUnsafe('ALTER TABLE "moderation_actions" DISABLE TRIGGER USER');
  try {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "friendships","pixels","pixel_events","Canvas","Membership","User","Tenant" CASCADE',
    );
  } finally {
    await prisma.$executeRawUnsafe('ALTER TABLE "pixel_events" ENABLE TRIGGER USER');
    await prisma.$executeRawUnsafe('ALTER TABLE "moderation_actions" ENABLE TRIGGER USER');
  }
}

async function seedTenant(slug: string): Promise<string> {
  const t = await prisma.tenant.create({ data: { slug, publicTitle: slug.toUpperCase(), status: 'active' } });
  return t.id;
}

async function seedMember(tenantId: string, handle: string): Promise<string> {
  // Email is globally unique; the same public handle may recur across tenants (different users).
  const user = await prisma.user.create({
    data: { email: `${handle}.${tenantId}@rutgers.edu`, publicHandle: handle, status: 'active' },
  });
  await prisma.membership.create({ data: { tenantId, userId: user.id, role: 'participant', status: 'active' } });
  return user.id;
}

describe('friend graph (integration)', () => {
  beforeEach(reset);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('runs request → confirm → list → remove, and replays idempotently', async () => {
    const tenantId = await seedTenant('t1');
    const a = await seedMember(tenantId, 'amir');
    const b = await seedMember(tenantId, 'bea');

    const requested = await repo.sendFriendRequest({ tenantId, requesterUserId: a, targetHandle: 'bea', idempotencyKey: 'k1' });
    expect(requested.kind).toBe('requested');

    // Same key replays without creating a second row.
    const replay = await repo.sendFriendRequest({ tenantId, requesterUserId: a, targetHandle: 'bea', idempotencyKey: 'k1' });
    expect(replay).toMatchObject({ kind: 'exists', relationship: 'outgoing' });

    expect((await repo.listFriends(tenantId, b)).incoming.map((m) => m.handle)).toEqual(['amir']);
    expect((await repo.listFriends(tenantId, a)).outgoing.map((m) => m.handle)).toEqual(['bea']);

    expect((await repo.acceptFriendRequest(tenantId, b, 'amir')).kind).toBe('ok');

    expect((await repo.listFriends(tenantId, a)).friends.map((m) => m.handle)).toEqual(['bea']);
    expect((await repo.listFriends(tenantId, b)).friends.map((m) => m.handle)).toEqual(['amir']);

    // Search finds by handle prefix with the caller's relationship, never an email.
    expect(await repo.searchFriendCandidates(tenantId, a, 'be', 10)).toEqual([
      { handle: 'bea', displayName: null, role: 'participant', relationship: 'friends' },
    ]);

    expect((await repo.removeFriend(tenantId, a, 'bea')).kind).toBe('ok');
    expect((await repo.listFriends(tenantId, a)).friends).toEqual([]);
  });

  it('auto-accepts a reciprocal request (both wanted it)', async () => {
    const tenantId = await seedTenant('t2');
    const a = await seedMember(tenantId, 'cass');
    const b = await seedMember(tenantId, 'devon');
    await repo.sendFriendRequest({ tenantId, requesterUserId: a, targetHandle: 'devon', idempotencyKey: 'x1' });
    const reciprocal = await repo.sendFriendRequest({ tenantId, requesterUserId: b, targetHandle: 'cass', idempotencyKey: 'x2' });
    expect(reciprocal.kind).toBe('accepted');
    expect((await repo.listFriends(tenantId, a)).friends.map((m) => m.handle)).toEqual(['devon']);
  });

  it('rejects self-requests and unknown handles', async () => {
    const tenantId = await seedTenant('t3');
    const a = await seedMember(tenantId, 'ely');
    expect((await repo.sendFriendRequest({ tenantId, requesterUserId: a, targetHandle: 'ely', idempotencyKey: 'y1' })).kind).toBe('self');
    expect((await repo.sendFriendRequest({ tenantId, requesterUserId: a, targetHandle: 'ghost', idempotencyKey: 'y2' })).kind).toBe('not_found');
  });

  it('scopes the graph to the tenant', async () => {
    const t1 = await seedTenant('ta');
    const t2 = await seedTenant('tb');
    const a1 = await seedMember(t1, 'nova');
    await seedMember(t1, 'pax');
    await seedMember(t2, 'pax'); // same handle, different tenant
    await repo.sendFriendRequest({ tenantId: t1, requesterUserId: a1, targetHandle: 'pax', idempotencyKey: 'z1' });
    // The other tenant sees nothing.
    const other = await seedMember(t2, 'quinn');
    expect((await repo.listFriends(t2, other)).outgoing).toEqual([]);
    expect((await repo.searchFriendCandidates(t2, other, 'nova', 10))).toEqual([]);
  });
});
