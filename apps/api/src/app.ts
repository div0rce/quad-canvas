// apps/api — application factory. buildApp wires plugins + routes but does NOT listen, so it is
// reusable for tests (app.inject) and the composition root (index.ts).
import Fastify from 'fastify';
import websocketPlugin from '@fastify/websocket';
import cookiePlugin from '@fastify/cookie';
import type { FastifyInstance, FastifyServerOptions } from 'fastify';
import type { domain } from '@quad/core';
import { SubscriptionRegistry } from '@quad/realtime';
import errorsPlugin from './plugins/errors.js';
import tenantPlugin from './plugins/tenant.js';
import { makeIdentityPlugin, type IdentityResolver } from './plugins/identity.js';
import healthRoutes from './routes/health.js';
import { makePixelRoutes } from './routes/pixels.js';
import { makeWsRoutes } from './routes/ws.js';
import { makeSessionRoutes } from './routes/session.js';
import { makeModerationRoutes } from './routes/moderation.js';
import { makeAdminRoutes } from './routes/admin.js';
import { makeReportRoutes } from './routes/reports.js';
import { makeArchiveRoutes } from './routes/archives.js';
import { makeProfileRoutes } from './routes/profiles.js';
import { makeLeaderboardRoutes } from './routes/leaderboards.js';
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
}

const ROLES: readonly domain.Role[] = ['participant', 'moderator', 'admin', 'operator'];

/** Narrow a DB role string to a known role, or null (fail-closed — never trust an unknown value). */
function toRole(role: string): domain.Role | null {
  return (ROLES as readonly string[]).includes(role) ? (role as domain.Role) : null;
}

/** Build a configured (but not-yet-listening) Fastify instance. */
export async function buildApp(opts: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger ?? false,
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

  await app.register(errorsPlugin);
  await app.register(cookiePlugin);
  await app.register(tenantPlugin);
  await app.register(makeIdentityPlugin(resolver));
  await app.register(healthRoutes);

  if (opts.auth?.service) {
    await app.register(
      makeAuthRoutes(opts.auth.service, opts.auth.sessionStore, {
        sessionTtlSeconds: opts.auth.sessionTtlSeconds ?? 60 * 60 * 12,
        cookieSecure: opts.auth.cookieSecure ?? true,
      }),
    );
  }

  if (opts.auth && opts.placement) {
    await app.register(makeModerationRoutes(opts.placement.repo, opts.auth.sessionStore, opts.placement.bus));
    await app.register(makeAdminRoutes(opts.placement.repo, opts.auth.sessionStore, opts.placement.bus));
    await app.register(makeReportRoutes(opts.placement.repo));
  }

  if (opts.placement) {
    await app.register(makePixelRoutes(opts.placement));
    await app.register(makeSessionRoutes(opts.placement.repo));
    await app.register(makeArchiveRoutes(opts.placement.repo));
    await app.register(makeProfileRoutes(opts.placement.repo));
    await app.register(makeLeaderboardRoutes(opts.placement.repo));
    const registry = new SubscriptionRegistry();
    const unsubscribeBus = opts.placement.bus.subscribe((m) => registry.broadcast(m.tenantId, m.canvasId, m.message));
    app.addHook('onClose', async () => {
      unsubscribeBus();
    });
    await app.register(websocketPlugin, { options: { maxPayload: 1_048_576 } });
    await app.register(makeWsRoutes(registry, opts.placement.repo));
  }

  return app;
}
