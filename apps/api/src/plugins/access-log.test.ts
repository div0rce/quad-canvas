import { describe, it, expect } from 'vitest';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { buildAccessLog, buildRequestLogFields } from './access-log.js';

function req(over: Record<string, unknown>): FastifyRequest {
  return { id: 'r1', method: 'GET', url: '/x', ...over } as unknown as FastifyRequest;
}
function reply(over: Record<string, unknown>): FastifyReply {
  return { statusCode: 200, elapsedTime: 0, ...over } as unknown as FastifyReply;
}

describe('buildAccessLog', () => {
  it('uses the route template (not the concrete URL) and rounds the duration', () => {
    const fields = buildAccessLog(
      req({ routeOptions: { url: '/api/v1/profiles/:handle' }, url: '/api/v1/profiles/alice', tenant: { id: 'ten_rutgers' } }),
      reply({ statusCode: 200, elapsedTime: 12.7 }),
    );
    expect(fields).toEqual({ reqId: 'r1', method: 'GET', route: '/api/v1/profiles/:handle', status: 200, durationMs: 13, tenant: 'ten_rutgers' });
  });

  it('uses a fixed label (never the user-controlled path) when no route matched (e.g. 404)', () => {
    const fields = buildAccessLog(req({ url: '/reset/alice@example.edu?secret=x', routeOptions: undefined }), reply({ statusCode: 404 }));
    expect(fields.route).toBe('(unmatched)');
    expect(fields.status).toBe(404);
    expect(fields.tenant).toBeUndefined();
    expect(JSON.stringify(fields)).not.toContain('@'); // user path (with an email) never logged
  });

  it('emits only DC-safe fields (no email/cookie/auth/body)', () => {
    const fields = buildAccessLog(
      req({ routeOptions: { url: '/api/v1/session' }, tenant: { id: 't' }, headers: { cookie: 'quad_session=secret', authorization: 'x' } }),
      reply({ statusCode: 200 }),
    );
    const keys = Object.keys(fields);
    expect(keys.sort()).toEqual(['durationMs', 'method', 'reqId', 'route', 'status', 'tenant']);
    expect(JSON.stringify(fields)).not.toMatch(/secret|cookie|authorization|@/i);
  });

  it('does not repeat the request id already bound by Fastify request.log', () => {
    const fields = buildRequestLogFields(req({ routeOptions: { url: '/healthz' } }), reply({ statusCode: 200 }));
    expect(fields).toEqual({ method: 'GET', route: '/healthz', status: 200, durationMs: 0 });
    expect(fields).not.toHaveProperty('reqId');
  });
});
