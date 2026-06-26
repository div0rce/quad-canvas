// apps/api — defensive security headers on every response (set in onRequest so they're present even
// on 404/error replies). The API returns JSON only, so a strict `default-src 'none'` CSP and
// frame/embedding denial are appropriate; HSTS is sent unconditionally (browsers ignore it over
// plain HTTP, so it only takes effect once served over TLS). fp-wrapped → applies app-wide.
import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

const HSTS = 'max-age=31536000; includeSubDomains';
const CSP = "default-src 'none'; frame-ancestors 'none'";

const securityHeadersPlugin: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', async (_request, reply) => {
    void reply.header('X-Content-Type-Options', 'nosniff');
    void reply.header('X-Frame-Options', 'DENY');
    void reply.header('Referrer-Policy', 'no-referrer');
    void reply.header('Strict-Transport-Security', HSTS);
    void reply.header('Content-Security-Policy', CSP);
    void reply.header('X-Permitted-Cross-Domain-Policies', 'none');
    void reply.header('Cross-Origin-Resource-Policy', 'same-origin');
  });
};

export default fp(securityHeadersPlugin, { name: 'security-headers' });
