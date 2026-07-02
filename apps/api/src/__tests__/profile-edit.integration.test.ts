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
      'TRUNCATE TABLE "guild_memberships","guilds","friendships","pixels","pixel_events","Canvas","Membership","User","Tenant" CASCADE',
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
async function seedHandlelessMember(tenantId: string, email: string): Promise<string> {
  const user = await prisma.user.create({ data: { email, status: 'active' } }); // no handle yet (new member)
  await prisma.membership.create({ data: { tenantId, userId: user.id, role: 'participant', status: 'active' } });
  return user.id;
}

describe('profile self-edit (integration)', () => {
  beforeEach(reset);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('sets the handle + display name and enforces tenant-scoped, case-insensitive uniqueness', async () => {
    const t = await seedTenant('p1');
    const a = await seedHandlelessMember(t, `a.${t}@rutgers.edu`);
    const b = await seedHandlelessMember(t, `b.${t}@rutgers.edu`);

    expect(await repo.updateProfile({ tenantId: t, userId: a, handle: 'amir7', displayName: 'Amir' })).toEqual({ kind: 'ok', handle: 'amir7' });

    // Another member cannot take it, even with different casing.
    expect((await repo.updateProfile({ tenantId: t, userId: b, handle: 'AMIR7' })).kind).toBe('handle_taken');
    // Invalid handles are rejected.
    expect((await repo.updateProfile({ tenantId: t, userId: b, handle: 'no space' })).kind).toBe('invalid_handle');
    expect((await repo.updateProfile({ tenantId: t, userId: b, handle: 'ab' })).kind).toBe('invalid_handle');
    // A free handle succeeds.
    expect((await repo.updateProfile({ tenantId: t, userId: b, handle: 'bea' })).kind).toBe('ok');

    // The same handle is free in a different tenant.
    const t2 = await seedTenant('p2');
    const c = await seedHandlelessMember(t2, `c.${t2}@rutgers.edu`);
    expect((await repo.updateProfile({ tenantId: t2, userId: c, handle: 'amir7' })).kind).toBe('ok');
  });
});
