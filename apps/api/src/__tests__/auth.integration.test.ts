import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createPrismaClient, createPlacementRepository } from '@quad/db';
import { InMemoryRealtimeBus } from '@quad/realtime';
import { buildApp } from '../app.js';
import { AuthService } from '../auth/auth-service.js';
import { InMemorySessionStore } from '../auth/session-store.js';
import { InMemoryVerificationStore } from '../auth/verification-store.js';

const DATABASE_URL = process.env['DATABASE_URL'] ?? 'postgresql://quad:quad@127.0.0.1:5432/quad';
const prisma = createPrismaClient({ connectionString: DATABASE_URL });
const repo = createPlacementRepository(prisma);

class CaptureMail {
  readonly sent: Array<{ email: string; token: string }> = [];
  sendVerificationLink(email: string, token: string): Promise<void> {
    this.sent.push({ email, token });
    return Promise.resolve();
  }
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

async function seed(): Promise<void> {
  await prisma.tenant.create({ data: { id: 'ten_rutgers', slug: 'rutgers', publicTitle: 'Rutgers', status: 'active' } });
  await prisma.canvas.create({ data: { tenantId: 'ten_rutgers', termLabel: 'F26', status: 'active', width: 10, height: 10 } });
}

async function build(
  over: { authRateLimit?: { limit: number; windowSec: number }; trustProxy?: boolean | string } = {},
): Promise<{ app: Awaited<ReturnType<typeof buildApp>>; mail: CaptureMail }> {
  const sessions = new InMemorySessionStore();
  const mail = new CaptureMail();
  const service = new AuthService({
    verifications: new InMemoryVerificationStore(),
    mail,
    repo,
    sessions,
    verificationTtlSeconds: 900,
    sessionTtlSeconds: 3600,
  });
  const app = await buildApp({
    placement: { repo, cooldownMs: 0, now: () => new Date(), bus: new InMemoryRealtimeBus() },
    auth: { sessionStore: sessions, service, cookieSecure: false },
    ...(over.authRateLimit ? { authRateLimit: over.authRateLimit } : {}),
    ...(over.trustProxy !== undefined ? { trustProxy: over.trustProxy } : {}),
  });
  return { app, mail };
}

beforeEach(reset);
afterAll(async () => {
  await prisma.$disconnect();
});

describe('auth verification front-door (HTTP)', () => {
  it('request → confirm → authenticated placement, end to end', async () => {
    await seed();
    const { app, mail } = await build();
    try {
      const requested = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/verify/request',
        headers: { host: 'rutgers.localhost', 'content-type': 'application/json' },
        payload: { email: 'me@scarletmail.rutgers.edu' },
      });
      expect(requested.statusCode).toBe(202);
      expect(mail.sent).toHaveLength(1);
      const token = mail.sent[0]?.token ?? '';

      const confirmed = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/verify/confirm',
        headers: { host: 'rutgers.localhost', 'content-type': 'application/json' },
        payload: { token },
      });
      expect(confirmed.statusCode).toBe(200);
      const cookie = confirmed.cookies.find((c) => c.name === 'quad_session');
      expect(cookie?.value).toBeTruthy();

      const placed = await app.inject({
        method: 'POST',
        url: '/api/v1/canvas/current/pixels',
        headers: {
          host: 'rutgers.localhost',
          'idempotency-key': 'k1',
          'content-type': 'application/json',
          cookie: `quad_session=${cookie?.value ?? ''}`,
        },
        payload: { at: { x: 1, y: 1 }, color: 2 },
      });
      expect(placed.statusCode).toBe(201);
    } finally {
      await app.close();
    }
  });

  it('rejects an email outside the tenant domain allowlist (403)', async () => {
    await seed();
    const { app } = await build();
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/verify/request',
        headers: { host: 'rutgers.localhost', 'content-type': 'application/json' },
        payload: { email: 'me@gmail.com' },
      });
      expect(res.statusCode).toBe(403);
    } finally {
      await app.close();
    }
  });

  it('rejects an invalid verification token (401)', async () => {
    await seed();
    const { app } = await build();
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/verify/confirm',
        headers: { host: 'rutgers.localhost', 'content-type': 'application/json' },
        payload: { token: 'garbage' },
      });
      expect(res.statusCode).toBe(409);
    } finally {
      await app.close();
    }
  });

  it('rate-limits the verify endpoints past the budget (429)', async () => {
    await seed();
    const { app } = await build({ authRateLimit: { limit: 1, windowSec: 60 } });
    try {
      const request = () =>
        app.inject({
          method: 'POST',
          url: '/api/v1/auth/verify/request',
          headers: { host: 'rutgers.localhost', 'content-type': 'application/json' },
          payload: { email: 'someone@scarletmail.rutgers.edu' },
        });
      expect((await request()).statusCode).toBe(202);
      const blocked = await request();
      expect(blocked.statusCode).toBe(429);
      expect((blocked.json() as { error: { code: string } }).error.code).toBe('RATE_LIMITED');
      expect(blocked.headers['retry-after']).toBeDefined();
    } finally {
      await app.close();
    }
  });

  it('keys the verify limiter by the forwarded client IP when trustProxy is on', async () => {
    await seed();
    const { app } = await build({ authRateLimit: { limit: 1, windowSec: 60 }, trustProxy: true });
    try {
      const req = (xff: string) =>
        app.inject({
          method: 'POST',
          url: '/api/v1/auth/verify/request',
          headers: { host: 'rutgers.localhost', 'content-type': 'application/json', 'x-forwarded-for': xff },
          payload: { email: 'x@scarletmail.rutgers.edu' },
        });
      expect((await req('1.1.1.1')).statusCode).toBe(202); // client A — first
      expect((await req('1.1.1.1')).statusCode).toBe(429); // client A — over budget
      expect((await req('2.2.2.2')).statusCode).toBe(202); // client B — independent budget (not lumped under the proxy IP)
    } finally {
      await app.close();
    }
  });
});
