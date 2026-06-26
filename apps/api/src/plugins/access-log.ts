// apps/api — structured access logging. An onResponse hook emits one DC-safe line per request:
// request id, method, the matched ROUTE TEMPLATE (e.g. /api/v1/profiles/:handle — not the raw URL,
// so concrete handle values aren't logged and lines aggregate cleanly), status, duration, and the
// resolved tenant. Deliberately NO email/DC3, cookies, auth headers, query string, or body.
import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';

export interface AccessLogFields {
  readonly reqId: string;
  readonly method: string;
  readonly route: string;
  readonly status: number;
  readonly durationMs: number;
  readonly tenant?: string;
}

/** Build the DC-safe access-log payload. Pure (testable) — the hook just logs the result. */
export function buildAccessLog(request: FastifyRequest, reply: FastifyReply): AccessLogFields {
  const tenant = request.tenant?.id;
  return {
    reqId: request.id,
    method: request.method,
    // Route TEMPLATE only; a fixed label for unmatched (404) requests. Never the concrete URL — its
    // path segments are user-controlled and could carry an email/secret (e.g. /reset/a@b.edu).
    route: request.routeOptions?.url ?? '(unmatched)',
    status: reply.statusCode,
    durationMs: Math.round(reply.elapsedTime ?? 0),
    ...(tenant ? { tenant } : {}),
  };
}

const accessLogPlugin: FastifyPluginAsync = async (app) => {
  app.addHook('onResponse', async (request, reply) => {
    request.log.info(buildAccessLog(request, reply), 'request completed');
  });
};

export default fp(accessLogPlugin, { name: 'access-log' });
