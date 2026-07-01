// apps/api — runtime composition shared by the normal listener (src/index.ts) and the Vercel
// server export (src/app.ts). This is the only place production dependencies are assembled.
import type { FastifyInstance, FastifyServerOptions } from 'fastify';
import { Redis } from 'ioredis';
import { cooldown } from '@quad/core';
import { createPlacementRepository, createPrismaClient } from '@quad/db';
import { InMemoryRealtimeBus, RedisRealtimeBus, type RealtimeBus } from '@quad/realtime';
import { AuthService } from './auth/auth-service.js';
import { LogMailTransport, NullMailTransport, ResendMailTransport, type MailTransport } from './auth/mail.js';
import { InMemorySessionStore, RedisSessionStore, type SessionStore } from './auth/session-store.js';
import { InMemoryVerificationStore, RedisVerificationStore } from './auth/verification-store.js';
import { buildApp } from './app.js';
import { RedisRateLimiter } from './rate-limit/rate-limiter.js';
import type { ReadinessCheck } from './routes/health.js';
import { clampCooldownMs } from './services/cooldown.js';
import type { PlacementDeps } from './services/placement.js';
import { RedisRateCounter, type RateCounter } from './services/rate-counter.js';

const VERIFICATION_TTL_SECONDS = 15 * 60;
const SESSION_TTL_SECONDS = 12 * 60 * 60;
// Local HTTP dev must not emit a Secure cookie or the browser will ignore the sign-in session.
// Production stays Secure-by-default; QUAD_COOKIE_INSECURE remains an explicit escape hatch.
const COOKIE_SECURE = process.env['QUAD_COOKIE_INSECURE'] === '1' ? false : process.env['NODE_ENV'] === 'production';
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

export type RuntimeCleanup = () => Promise<void>;

export interface RuntimeApp {
  readonly app: FastifyInstance;
  readonly cleanups: readonly RuntimeCleanup[];
}

export interface RuntimeAppOptions {
  readonly logger?: FastifyServerOptions['logger'];
}

interface MailRuntimeConfig {
  readonly logToken: boolean;
  readonly provider?: string;
  readonly resendApiKey?: string;
  readonly emailApiKey?: string;
  readonly emailFrom?: string;
  readonly webBaseUrl?: string;
  readonly log: (message: string) => void;
}

interface MailRuntimeSelection {
  readonly mail: MailTransport;
  readonly delivers: boolean;
  readonly warning?: string;
}

function configuredResendApiKey(config: MailRuntimeConfig): string | undefined {
  if (config.resendApiKey) return config.resendApiKey;
  return config.provider?.toLowerCase() === 'resend' ? config.emailApiKey : undefined;
}

function buildRuntimeMailTransport(config: MailRuntimeConfig): MailRuntimeSelection {
  const provider = config.provider?.trim().toLowerCase();
  const apiKey = configuredResendApiKey(config);
  if ((provider === undefined || provider === '' || provider === 'resend') && apiKey && config.emailFrom && config.webBaseUrl) {
    return {
      mail: new ResendMailTransport({
        apiKey,
        from: config.emailFrom,
        baseUrl: config.webBaseUrl,
        log: config.log,
      }),
      delivers: true,
    };
  }

  if (config.logToken) {
    return { mail: new LogMailTransport(config.log), delivers: false };
  }

  const missing = [
    ...(apiKey ? [] : ['RESEND_API_KEY']),
    ...(config.emailFrom ? [] : ['EMAIL_FROM']),
    ...(config.webBaseUrl ? [] : ['WEB_BASE_URL']),
  ];
  const unsupportedProvider =
    provider && provider !== 'resend' ? ` Unsupported EMAIL_PROVIDER "${provider}" is not wired.` : '';
  const missingConfig = missing.length > 0 ? ` Missing ${missing.join(', ')}.` : '';
  return {
    mail: new NullMailTransport(config.log),
    delivers: false,
    warning: `No mail provider is configured: email verification links are NOT delivered.${unsupportedProvider}${missingConfig}`,
  };
}

export async function createRuntimeApp(opts: RuntimeAppOptions = {}): Promise<RuntimeApp> {
  let placement: PlacementDeps | undefined;
  let bus: RealtimeBus | undefined;
  let sessionStore: SessionStore | undefined;
  let sessionRedis: Redis | undefined;
  let authService: AuthService | undefined;
  let mailWarning: string | undefined;
  const readinessChecks: ReadinessCheck[] = [];
  const cleanups: RuntimeCleanup[] = [];
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
    // Verification front-door: tokens share the session Redis (distinct key prefix).
    const verifications = sessionRedis ? new RedisVerificationStore(sessionRedis) : new InMemoryVerificationStore();
    // Mail transport. The verification token is a bearer credential (it alone mints a session), so it
    // must never reach production logs. Log it ONLY outside production (dev needs it to complete the
    // local flow with no provider) or on an explicit opt-in; in production with no real provider, use
    // the token-free transport AND warn that links aren't delivered (no silent "success"). Production
    // wires Resend via this same MailTransport seam.
    const isProd = process.env['NODE_ENV'] === 'production';
    const logToken = !isProd || process.env['QUAD_LOG_MAIL_TOKEN'] === '1';
    const logAuth = (m: string): void => void process.stdout.write(`[auth] ${m}\n`);
    const mailSelection = buildRuntimeMailTransport({
      logToken,
      ...(process.env['EMAIL_PROVIDER'] ? { provider: process.env['EMAIL_PROVIDER'] } : {}),
      ...(process.env['RESEND_API_KEY'] ? { resendApiKey: process.env['RESEND_API_KEY'] } : {}),
      ...(process.env['EMAIL_API_KEY'] ? { emailApiKey: process.env['EMAIL_API_KEY'] } : {}),
      ...(process.env['EMAIL_FROM'] ? { emailFrom: process.env['EMAIL_FROM'] } : {}),
      ...(process.env['WEB_BASE_URL'] ? { webBaseUrl: process.env['WEB_BASE_URL'] } : {}),
      log: logAuth,
    });
    const mail = mailSelection.mail;
    mailWarning = !mailSelection.delivers && !logToken ? mailSelection.warning : undefined;
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
    logger: opts.logger ?? true,
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
  if (mailWarning) {
    app.log.warn(mailWarning);
  }

  return { app, cleanups };
}
