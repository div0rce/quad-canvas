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
async function seedMember(tenantId: string, handle: string): Promise<string> {
  const user = await prisma.user.create({ data: { email: `${handle}.${tenantId}@rutgers.edu`, publicHandle: handle, status: 'active' } });
  await prisma.membership.create({ data: { tenantId, userId: user.id, role: 'participant', status: 'active' } });
  return user.id;
}

describe('guilds (integration)', () => {
  beforeEach(reset);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates (auto-join + active), enforces one active guild, joins, lists, and leaves', async () => {
    const t = await seedTenant('g1');
    const a = await seedMember(t, 'amir');

    const created = await repo.createGuild({ tenantId: t, userId: a, name: 'Rutgers ECE', description: 'Engineers' });
    expect(created).toMatchObject({ kind: 'created', slug: 'rutgers-ece' });
    expect((await repo.createGuild({ tenantId: t, userId: a, name: 'Rutgers ECE', description: null })).kind).toBe('duplicate');
    expect((await repo.createGuild({ tenantId: t, userId: a, name: '!!!', description: null })).kind).toBe('invalid');

    expect(await repo.listGuilds(t, a)).toEqual([
      expect.objectContaining({ slug: 'rutgers-ece', memberCount: 1, joined: true, active: true }),
    ]);

    // A second guild becomes the active one; the first is deactivated (one active per user).
    await repo.createGuild({ tenantId: t, userId: a, name: 'Busch Painters', description: null });
    let list = await repo.listGuilds(t, a);
    expect(list.find((g) => g.slug === 'busch-painters')?.active).toBe(true);
    expect(list.find((g) => g.slug === 'rutgers-ece')?.active).toBe(false);

    expect((await repo.setActiveGuild(t, a, 'rutgers-ece')).kind).toBe('ok');
    list = await repo.listGuilds(t, a);
    expect(list.find((g) => g.slug === 'rutgers-ece')?.active).toBe(true);
    expect(list.find((g) => g.slug === 'busch-painters')?.active).toBe(false);

    const b = await seedMember(t, 'bea');
    expect((await repo.joinGuild(t, b, 'rutgers-ece')).kind).toBe('ok');
    const detail = await repo.getGuild(t, b, 'rutgers-ece');
    expect(detail?.memberCount).toBe(2);
    expect(detail?.joined).toBe(true);
    expect(detail?.members.map((m) => m.handle).sort()).toEqual(['amir', 'bea']);

    // Set-active requires membership first.
    const c = await seedMember(t, 'cass');
    expect((await repo.setActiveGuild(t, c, 'rutgers-ece')).kind).toBe('not_found');

    expect((await repo.leaveGuild(t, b, 'rutgers-ece')).kind).toBe('ok');
    expect((await repo.getGuild(t, b, 'rutgers-ece'))?.memberCount).toBe(1);
  });

  it('scopes guilds to the tenant', async () => {
    const t1 = await seedTenant('ga');
    const t2 = await seedTenant('gb');
    const a = await seedMember(t1, 'nova');
    await repo.createGuild({ tenantId: t1, userId: a, name: 'Only T1', description: null });
    const b = await seedMember(t2, 'quinn');
    expect(await repo.listGuilds(t2, b)).toEqual([]);
    expect(await repo.getGuild(t2, b, 'only-t1')).toBeNull();
  });
});
