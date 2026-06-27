// apps/api — composition root. Reads PORT/HOST + the DB connection string (the only place env is
// read) and starts the server. The Postgres connection string is supplied here and passed to the
// driver adapter in @quad/db; placement routes are wired only when a database is configured.
import { buildApp } from './app.js';
import { createPrismaClient, createPlacementRepository } from '@quad/db';
import { InMemoryRealtimeBus, RedisRealtimeBus, type RealtimeBus } from '@quad/realtime';
import { Redis } from 'ioredis';
import { cooldown } from '@quad/core';
import type { PlacementDeps } from './services/placement.js';
import { InMemorySessionStore, RedisSessionStore, type SessionStore } from './auth/session-store.js';
import { InMemoryVerificationStore, RedisVerificationStore } from './auth/verification-store.js';
import { LogMailTransport } from './auth/mail.js';
import { AuthService } from './auth/auth-service.js';
import { RedisRateLimiter } from './rate-limit/rate-limiter.js';
import type { ReadinessCheck } from './routes/health.js';
import { createGracefulShutdown } from './shutdown.js';

const VERIFICATION_TTL_SECONDS = 15 * 60;
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const COOKIE_SECURE = process.env['QUAD_COOKIE_INSECURE'] !== '1';

const PORT = Number(process.env['PORT'] ?? 3000);
const HOST = process.env['HOST'] ?? '127.0.0.1';
const DATABASE_URL = process.env['DATABASE_URL'];
const REDIS_URL = process.env['REDIS_URL'];
// Behind the LB, trust forwarded headers so per-IP rate limiting sees the real client. '1'/'true' →
// trust the immediate proxy; any other non-empty value is passed through (IP/CIDR/hop count).
const rawTrustProxy = process.env['TRUST_PROXY']?.trim();
const TRUST_PROXY: boolean | string =
  rawTrustProxy === '1' || rawTrustProxy === 'true' ? true : rawTrustProxy && rawTrustProxy !== '' ? rawTrustProxy : false;
// Fail-closed: an unset/empty/non-numeric/negative override falls back to the default cooldown
// (never to 0 by accident). An explicit non-negative number is honoured.
const DEFAULT_COOLDOWN_MS = cooldown.COOLDOWN_MIN_MINUTES * 60_000;
const rawCooldown = process.env['QUAD_COOLDOWN_MS'];
const parsedCooldown = rawCooldown !== undefined && rawCooldown.trim() !== '' ? Number(rawCooldown) : Number.NaN;
const COOLDOWN_MS = Number.isFinite(parsedCooldown) && parsedCooldown >= 0 ? parsedCooldown : DEFAULT_COOLDOWN_MS;

async function main(): Promise<void> {
  let placement: PlacementDeps | undefined;
  let bus: RealtimeBus | undefined;
  let sessionStore: SessionStore | undefined;
  let sessionRedis: Redis | undefined;
  let authService: AuthService | undefined;
  const readinessChecks: ReadinessCheck[] = [];
  const cleanups: Array<() => Promise<void>> = [];
  if (DATABASE_URL) {
    const prisma = createPrismaClient({ connectionString: DATABASE_URL });
    cleanups.push(() => prisma.$disconnect());
    // Deep readiness: a trivial query proves the DB is reachable (not just that the process is up).
    readinessChecks.push({
      name: 'database',
      check: async () => {
        await prisma.$queryRaw`SELECT 1`;
      },
    });
    // Redis-backed fan-out (cross-node) when REDIS_URL is set; otherwise in-memory (single node).
    // Both implement the same RealtimeBus interface, so nothing else changes.
    bus = REDIS_URL ? new RedisRealtimeBus(REDIS_URL) : new InMemoryRealtimeBus();
    await bus.ready();
    cleanups.push(async () => {
      await bus?.close();
    });
    placement = {
      repo: createPlacementRepository(prisma),
      cooldownMs: COOLDOWN_MS,
      now: () => new Date(),
      bus,
    };
    // Server-side sessions (Redis where available). The verification front-door that issues
    // sessions is a follow-on; until then this validates sessions only (none exist yet → 401).
    if (REDIS_URL) {
      sessionRedis = new Redis(REDIS_URL);
      sessionStore = new RedisSessionStore(sessionRedis);
      const redis = sessionRedis;
      cleanups.push(async () => {
        await redis.quit();
      });
      readinessChecks.push({
        name: 'redis',
        check: async () => {
          await redis.ping();
        },
      });
    } else {
      sessionStore = new InMemorySessionStore();
    }
    // Verification front-door: tokens share the session Redis (distinct key prefix). The mail
    // transport is a no-op logger by default — production wires the real provider (B6/SMTP).
    const verifications = sessionRedis ? new RedisVerificationStore(sessionRedis) : new InMemoryVerificationStore();
    authService = new AuthService({
      verifications,
      // No real provider configured: surface the masked link to the server log so tokens are not
      // silently dropped (dev fallback). Production wires B6/SMTP via this same MailTransport seam.
      mail: new LogMailTransport((m) => process.stdout.write(`[auth] ${m}\n`)),
      repo: placement.repo,
      sessions: sessionStore,
      verificationTtlSeconds: VERIFICATION_TTL_SECONDS,
      sessionTtlSeconds: SESSION_TTL_SECONDS,
    });
  }

  const app = await buildApp({
    logger: true,
    trustProxy: TRUST_PROXY,
    ...(readinessChecks.length ? { readinessChecks } : {}),
    ...(placement ? { placement } : {}),
    // Cross-node abuse protection when Redis is available (reuses the session client; distinct key
    // prefix). Without Redis, buildApp falls back to a single-node in-memory limiter.
    ...(sessionRedis ? { rateLimiter: new RedisRateLimiter(sessionRedis) } : {}),
    ...(sessionStore
      ? {
          auth: {
            sessionStore,
            ...(authService ? { service: authService } : {}),
            sessionTtlSeconds: SESSION_TTL_SECONDS,
            cookieSecure: COOKIE_SECURE,
          },
        }
      : {}),
  });
  if (!placement) {
    app.log.warn('DATABASE_URL is not set — placement routes are disabled (health only).');
  }

  // Drain in-flight requests (app.close) before closing the DB/Redis/bus; a watchdog forces exit if
  // anything hangs. Idempotent across repeated signals.
  const shutdown = createGracefulShutdown({
    close: () => app.close(),
    cleanups,
    log: { info: (obj, msg) => app.log.info(obj, msg), error: (obj, msg) => app.log.error(obj, msg) },
    exit: (code) => process.exit(code),
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (timer) => clearTimeout(timer as NodeJS.Timeout),
  });
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  try {
    await app.listen({ port: PORT, host: HOST });
  } catch (err) {
    app.log.error({ err }, 'failed to start server');
    process.exit(1);
  }
}

void main();
