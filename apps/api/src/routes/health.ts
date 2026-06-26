// apps/api — health & readiness. Liveness (`/healthz`) = the process is up. Readiness (`/readyz`)
// runs the configured dependency checks (DB, Redis, …): ALL must pass for 200 ready; any failure (or
// no checks configured) → 503. Failures never leak internal/DC detail — only a per-check ok/fail.
import type { FastifyPluginAsync } from 'fastify';

export interface ReadinessCheck {
  readonly name: string;
  /** Resolve when the dependency is reachable; reject/throw when it is not. */
  readonly check: () => Promise<void>;
}

export function makeHealthRoutes(checks: readonly ReadinessCheck[] = []): FastifyPluginAsync {
  return async (app) => {
    // Liveness: the process is up and serving. `tenant` (DC2 slug) reflects host resolution.
    app.get('/healthz', async (request) => {
      return {
        status: 'ok',
        uptimeSeconds: Math.round(process.uptime()),
        tenant: request.tenant ? request.tenant.slug : null,
      };
    });

    // Readiness: run every dependency check. 200 only when checks exist AND all pass; else 503.
    app.get('/readyz', async (request, reply) => {
      const results = await Promise.all(
        checks.map(async (c) => {
          try {
            await c.check();
            return [c.name, true] as const;
          } catch {
            return [c.name, false] as const; // never surface the error (no internal/DC leak)
          }
        }),
      );
      const ready = checks.length > 0 && results.every(([, ok]) => ok);
      const checkStatuses = Object.fromEntries(results.map(([name, ok]) => [name, { status: ok ? 'ok' : 'fail' }]));
      if (!ready) void reply.status(503);
      return {
        status: ready ? 'ok' : 'unavailable',
        ready,
        tenant: request.tenant ? request.tenant.slug : null,
        checks: { server: { status: 'ok' }, ...checkStatuses },
      };
    });
  };
}

export default makeHealthRoutes;
