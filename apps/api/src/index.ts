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
import { LogMailTransport, NullMailTransport } from './auth/mail.js';
import { AuthService } from './auth/auth-service.js';
import { RedisRateLimiter } from './rate-limit/rate-limiter.js';
import type { ReadinessCheck } from './routes/health.js';
import { createGracefulShutdown } from './shutdown.js';
import { RedisRateCounter, type RateCounter } from './services/rate-counter.js';
import { clampCooldownMs } from './services/cooldown.js';

const VERIFICATION_TTL_SECONDS = 15 * 60;
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const COOKIE_SECURE = process.env['QUAD_COOKIE_INSECURE'] !== '1';

// `??` only falls back on null/undefined, so a blank env var (e.g. `HOST=` in an env file) would slip
// through: HOST="" binds ALL interfaces and PORT="" → Number("")===0 binds a random port. Treat blank
// as unset, and fall back on a non-numeric/out-of-range port.
const HOST = process.env['HOST']?.trim() || '127.0.0.1';
const rawPort = process.env['PORT']?.trim();
const parsedPort = rawPort ? Number(rawPort) : 3000;
const PORT = Number.isInteger(parsedPort) && parsedPort >= 1 && parsedPort <= 65535 ? parsedPort : 3000;
const DATABASE_URL = process.env['DATABASE_URL'];
const REDIS_URL = process.env['REDIS_URL'];
// Behind the LB, trust forwarded headers so per-IP rate limiting sees the real client. A NUMBER is a
// hop COUNT (`1` = the immediate proxy; request.ip is the entry the LB appended, which a client can't
// spoof). A literal `true` trusts the ENTIRE X-Forwarded-For chain (spoofable — explicit escape hatch
// only). An IP/CIDR list is passed through. Anything else (unset/empty) → trust nothing.
const rawTrustProxy = process.env['TRUST_PROXY']?.trim();
const TRUST_PROXY: boolean | string | number =
  rawTrustProxy === 'true'
    ? true
    : rawTrustProxy && /^\d+$/.test(rawTrustProxy)
      ? Number(rawTrustProxy)
      : rawTrustProxy && rawTrustProxy !== ''
        ? rawTrustProxy
        : false;
// Fail-closed: an unset/empty/non-numeric/negative override falls back to the default cooldown
// (never to 0 by accident). An explicit non-negative number is honoured.
const MIN_COOLDOWN_MS = cooldown.COOLDOWN_MIN_MINUTES * 60_000;
const MAX_COOLDOWN_MS = cooldown.COOLDOWN_MAX_MINUTES * 60_000;
const rawCooldown = process.env['QUAD_COOLDOWN_MS'];
const parsedCooldown = rawCooldown !== undefined && rawCooldown.trim() !== '' ? Number(rawCooldown) : Number.NaN;
const requestedCooldown = Number.isFinite(parsedCooldown) && parsedCooldown >= 0 ? parsedCooldown : MIN_COOLDOWN_MS;
// P-AC-3: the enforced cooldown must ALWAYS be within 5–20 min — clamp any configured value into range.
const COOLDOWN_MS = clampCooldownMs(requestedCooldown, MIN_COOLDOWN_MS, MAX_COOLDOWN_MS);
// Load-based cooldown (opt-in): the value grows with the recent canvas-wide placement rate, bounded
// by COOLDOWN.md's 5–20 min. Saturation rate (placements/min at which it hits the ceiling) is tunable.
const DYNAMIC_COOLDOWN = process.env['QUAD_DYNAMIC_COOLDOWN'] === '1';
const rawSaturation = Number(process.env['QUAD_COOLDOWN_SATURATION_RPM']);
const COOLDOWN_SATURATION_RPM = Number.isFinite(rawSaturation) && rawSaturation > 0 ? rawSaturation : 120;

async function main(): Promise<void> {
  let placement: PlacementDeps | undefined;
  let bus: RealtimeBus | undefined;
  let sessionStore: SessionStore | undefined;
  let sessionRedis: Redis | undefined;
  let authService: AuthService | undefined;
  let mailNotDelivered = false; // prod with no real provider → warn (links aren't delivered)
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
    // Redis fast-path for the dynamic-cooldown load (offloads the per-placement DB count). Falls back
    // to the indexed DB count when Redis is absent.
    let rateCounter: RateCounter | undefined;
    if (DYNAMIC_COOLDOWN && REDIS_URL) {
      const rcRedis = new Redis(REDIS_URL);
      cleanups.push(async () => {
        await rcRedis.quit();
      });
      rateCounter = new RedisRateCounter(rcRedis);
    }
    placement = {
      repo: createPlacementRepository(prisma),
      cooldownMs: COOLDOWN_MS,
      now: () => new Date(),
      bus,
      ...(DYNAMIC_COOLDOWN
        ? {
            dynamicCooldown: {
              minMs: MIN_COOLDOWN_MS,
              maxMs: MAX_COOLDOWN_MS,
              saturationRatePerMin: COOLDOWN_SATURATION_RPM,
            },
          }
        : {}),
      ...(rateCounter ? { rateCounter } : {}),
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
    // Mail transport. The verification token is a bearer credential (it alone mints a session), so it
    // must never reach production logs. Log it ONLY outside production (dev needs it to complete the
    // local flow with no provider) or on an explicit opt-in; in production with no real provider, use
    // the token-free transport AND warn that links aren't delivered (no silent "success"). Production
    // wires B6/SMTP via this same MailTransport seam.
    const isProd = process.env['NODE_ENV'] === 'production';
    const logToken = !isProd || process.env['QUAD_LOG_MAIL_TOKEN'] === '1';
    const logAuth = (m: string): void => void process.stdout.write(`[auth] ${m}\n`);
    const mail = logToken ? new LogMailTransport(logAuth) : new NullMailTransport(logAuth);
    mailNotDelivered = !logToken; // no real SMTP is wired here; the null transport doesn't deliver
    authService = new AuthService({
      verifications,
      mail,
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
  if (mailNotDelivered) {
    app.log.warn(
      'No mail provider is configured: email verification links are NOT delivered. Wire SMTP/B6 before launch.',
    );
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
