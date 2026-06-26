// apps/api — auth verification endpoints (the magic-link front-door), per the API.md catalog:
// POST /auth/verify/request, POST /auth/verify/confirm, POST /auth/signout. The session cookie is
// opaque, httpOnly, and `SameSite=Lax` — the browser will not attach it to cross-site POST/fetch, so
// state-changing requests are CSRF-protected without a separate token (a double-submit CSRF token is
// a deferred refinement, AUTHENTICATION.md §24 / ADR-0006). The UI never sees the token.
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { dto } from '@quad/core';
import type { AuthService } from '../auth/auth-service.js';
import type { SessionStore } from '../auth/session-store.js';
import { SESSION_COOKIE } from '../plugins/identity.js';

export interface AuthRouteOptions {
  readonly sessionTtlSeconds: number;
  /** Set Secure on the cookie (true in production; false only for local http dev). */
  readonly cookieSecure: boolean;
}

function err(reply: FastifyReply, request: FastifyRequest, status: number, code: dto.ErrorCode, message: string): FastifyReply {
  const body: dto.ErrorResponse = { error: { code, message, requestId: request.id } };
  return reply.status(status).send(body);
}

export function makeAuthRoutes(service: AuthService, sessions: SessionStore, opts: AuthRouteOptions): FastifyPluginAsync {
  return async (app) => {
    app.post('/api/v1/auth/verify/request', async (request, reply) => {
      if (!request.tenant) return err(reply, request, 404, 'NOT_FOUND', 'No tenant for this host.');
      const body = (request.body ?? {}) as { email?: unknown };
      if (typeof body.email !== 'string') return err(reply, request, 422, 'VALIDATION_ERROR', 'email is required.');
      const result = await service.requestVerification(body.email, {
        id: request.tenant.id,
        domains: request.tenant.domains,
      });
      if (!result.ok && result.reason === 'INVALID_EMAIL') return err(reply, request, 422, 'VALIDATION_ERROR', 'Invalid email.');
      if (!result.ok && result.reason === 'DOMAIN_NOT_ALLOWED') {
        return err(reply, request, 403, 'FORBIDDEN', 'This email domain is not eligible for this tenant.');
      }
      return reply.status(202).send({ status: 'sent' });
    });

    app.post('/api/v1/auth/verify/confirm', async (request, reply) => {
      if (!request.tenant) return err(reply, request, 404, 'NOT_FOUND', 'No tenant for this host.');
      const body = (request.body ?? {}) as { token?: unknown };
      if (typeof body.token !== 'string') return err(reply, request, 422, 'VALIDATION_ERROR', 'token is required.');
      // Confirmation is bound to the resolved tenant — a token issued for another tenant is rejected.
      const sessionId = await service.confirm(body.token, request.tenant.id);
      if (sessionId === null) return err(reply, request, 409, 'CONFLICT', 'Invalid, expired, or already-used token.');
      void reply.setCookie(SESSION_COOKIE, sessionId, {
        httpOnly: true,
        secure: opts.cookieSecure,
        sameSite: 'lax',
        path: '/',
        maxAge: opts.sessionTtlSeconds,
      });
      return reply.status(200).send({ status: 'authenticated' });
    });

    app.post('/api/v1/auth/signout', async (request, reply) => {
      if (!request.principal) return err(reply, request, 401, 'UNAUTHENTICATED', 'Not signed in.');
      const sessionId = request.cookies?.[SESSION_COOKIE];
      if (sessionId) await sessions.revoke(sessionId);
      void reply.clearCookie(SESSION_COOKIE, { path: '/' });
      return reply.status(200).send({ status: 'signed-out' });
    });
  };
}
