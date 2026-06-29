// apps/api — application factory. buildApp wires plugins + routes but does NOT listen, so it is
// reusable for tests (app.inject) and the composition root (index.ts).
import Fastify from 'fastify';
import websocketPlugin from '@fastify/websocket';
import cookiePlugin from '@fastify/cookie';
import type { FastifyInstance, FastifyServerOptions } from 'fastify';
import { SubscriptionRegistry } from '@quad/realtime';
import errorsPlugin from './plugins/errors.js';
import securityHeadersPlugin from './plugins/security-headers.js';
import accessLogPlugin from './plugins/access-log.js';
import { makeMetricsPlugin } from './plugins/metrics.js';
import { MetricsRegistry } from './metrics/registry.js';
import tenantPlugin from './plugins/tenant.js';
import { makeIdentityPlugin, type IdentityResolver } from './plugins/identity.js';
import { makeHealthRoutes, type ReadinessCheck } from './routes/health.js';
import { makePixelRoutes } from './routes/pixels.js';
import { makeWsRoutes } from './routes/ws.js';
import { makeSessionRoutes } from './routes/session.js';
import { makeModerationRoutes } from './routes/moderation.js';
import { makeAdminRoutes } from './routes/admin.js';
import { makeReportRoutes } from './routes/reports.js';
import { makeArchiveRoutes } from './routes/archives.js';
import { makeProfileRoutes } from './routes/profiles.js';
import { makeLeaderboardRoutes } from './routes/leaderboards.js';
import { InMemoryRateLimiter, type RateLimiter } from './rate-limit/rate-limiter.js';
import { makeRateLimit } from './rate-limit/prehandler.js';
import { toRole } from './auth/roles.js';
import type { PlacementDeps } from './services/placement.js';
import type { SessionStore } from './auth/session-store.js';
import type { AuthService } from './auth/auth-service.js';
import { makeAuthRoutes } from './routes/auth.js';

export interface BuildAppOptions {
  readonly logger?: FastifyServerOptions['logger'];
  /** Placement dependencies (repository + cooldown policy). When provided, the pixel routes are
   *  registered. Wired from the DB driver adapter at the composition root, or injected in tests. */
  readonly placement?: PlacementDeps;
  /** Auth wiring. When provided (with placement), the session cookie resolves `request.principal`;
   *  otherwise `principal` stays null (pre-auth posture). The verification front-door (magic link)
   *  that issues sessions is a follow-on; this is the validation + placement-gating half. */
  readonly auth?: {
    readonly sessionStore: SessionStore;
    /** The verification front-door service. When present, the /auth endpoints are registered. */
    readonly service?: AuthService;
    readonly sessionTtlSeconds?: number;
    readonly cookieSecure?: boolean;
  };
  /** Abuse-protection limiter (default in-memory; inject a Redis-backed one in production). */
  readonly rateLimiter?: RateLimiter;
  /** Placement request budget (abuse protection — well above the cooldown-allowed human rate). */
  readonly placementRateLimit?: { readonly limit: number; readonly windowSec: number };
  /** Verify-endpoint budget per IP (anti-spam on magic-link request / anti-brute-force on confirm). */
  readonly authRateLimit?: { readonly limit: number; readonly windowSec: number };
  /** Report-filing budget per member (anti-spam). */
  readonly reportRateLimit?: { readonly limit: number; readonly windowSec: number };
  /**
   * Trust `X-Forwarded-*` so `request.ip` resolves the real client behind a proxy/load balancer
   * (production topology, DEPLOYMENT.md). Required for correct per-IP rate limiting of anonymous
   * traffic — otherwise every client shares the proxy socket IP. Default false (direct connections).
   * Set to a trusted proxy IP/CIDR (or hop count) rather than `true` when not solely behind the LB.
   */
  readonly trustProxy?: boolean | string | number;
  /** Max request body size in bytes (defense-in-depth — every endpoint takes tiny JSON). Default 16 KiB. */
  readonly bodyLimitBytes?: number;
  /** Request-metrics registry (default a fresh one). Inject to read counters in tests. */
  readonly metrics?: MetricsRegistry;
  /** Dependency checks for `/readyz` (DB, Redis, …) — built at the composition root. */
  readonly readinessChecks?: readonly ReadinessCheck[];
}


/** Build a configured (but not-yet-listening) Fastify instance. */
export async function buildApp(opts: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger ?? false,
    // Our access-log hook is the single, DC-safe access log (route template, no raw URL/query). Turn
    // off Fastify's built-in req/res logging so it doesn't duplicate or log the raw URL+query string.
    disableRequestLogging: true,
    // Behind the production LB, resolve the real client IP from X-Forwarded-For so per-IP rate
    // limiting of anonymous traffic doesn't lump every client under the proxy socket IP.
    trustProxy: opts.trustProxy ?? false,
    // Every endpoint takes a tiny JSON body; cap it well below Fastify's 1 MiB default so an
    // oversized payload is rejected (413) before it's buffered (memory-exhaustion defense).
    bodyLimit: opts.bodyLimitBytes ?? 16 * 1024,
  });

  // Resolve principals from sessions only when both a session store and the repository (for the
  // membership check) are present.
  let resolver: IdentityResolver | undefined;
  if (opts.auth && opts.placement) {
    const repo = opts.placement.repo;
    resolver = {
      store: opts.auth.sessionStore,
      memberships: {
        findActiveMembership: async (tenantId, userId) => {
          const membership = await repo.findActiveMembership(tenantId, userId);
          if (!membership) return null;
          const role = toRole(membership.role);
          return role ? { role } : null; // unknown/corrupt role → fail-closed
        },
      },
    };
  }

  // One abuse-protection limiter shared across endpoints (distinct buckets keep their budgets
  // independent). Default in-memory single-node; a Redis-backed one is injected in production.
  const limiter = opts.rateLimiter ?? new InMemoryRateLimiter();
  const authBudget = opts.authRateLimit ?? { limit: 10, windowSec: 60 };
  const reportBudget = opts.reportRateLimit ?? { limit: 20, windowSec: 60 };
  const authRateLimit = makeRateLimit(limiter, { ...authBudget, bucket: 'auth' });
  const reportRateLimit = makeRateLimit(limiter, { ...reportBudget, bucket: 'report' });

  const metrics = opts.metrics ?? new MetricsRegistry();

  // @fastify/websocket installs a preClose hook. Register it before any child plugins so Fastify
  // does not propagate that same hook into every existing child context and close one WSS repeatedly.
  if (opts.placement) {
    await app.register(websocketPlugin, { options: { maxPayload: 1_048_576 } });
  }

  await app.register(securityHeadersPlugin);
  await app.register(accessLogPlugin);
  await app.register(makeMetricsPlugin(metrics));
  await app.register(errorsPlugin);
  await app.register(cookiePlugin);
  await app.register(tenantPlugin);
  await app.register(makeIdentityPlugin(resolver));
  await app.register(makeHealthRoutes(opts.readinessChecks ?? []));

  if (opts.auth?.service) {
    await app.register(
      makeAuthRoutes(opts.auth.service, opts.auth.sessionStore, {
        sessionTtlSeconds: opts.auth.sessionTtlSeconds ?? 60 * 60 * 12,
        cookieSecure: opts.auth.cookieSecure ?? true,
        rateLimit: authRateLimit,
      }),
    );
  }

  if (opts.auth && opts.placement) {
    await app.register(makeModerationRoutes(opts.placement.repo, opts.auth.sessionStore, opts.placement.bus));
    await app.register(makeAdminRoutes(opts.placement.repo, opts.auth.sessionStore, opts.placement.bus));
    await app.register(makeReportRoutes(opts.placement.repo, reportRateLimit));
  }

  if (opts.placement) {
    // Abuse protection on writes (RATE_LIMITED) — distinct from the in-transaction placement cooldown.
    const placeBudget = opts.placementRateLimit ?? { limit: 240, windowSec: 60 };
    const placementRateLimit = makeRateLimit(limiter, { ...placeBudget, bucket: 'place' });
    await app.register(makePixelRoutes(opts.placement, placementRateLimit));
    await app.register(makeSessionRoutes(opts.placement.repo));
    await app.register(makeArchiveRoutes(opts.placement.repo));
    await app.register(makeProfileRoutes(opts.placement.repo));
    await app.register(makeLeaderboardRoutes(opts.placement.repo));
    const registry = new SubscriptionRegistry();
    const unsubscribeBus = opts.placement.bus.subscribe((m) => registry.broadcast(m.tenantId, m.canvasId, m.message));
    app.addHook('onClose', async () => {
      unsubscribeBus();
    });
    await app.register(makeWsRoutes(registry, opts.placement.repo));
  }

  return app;
}
