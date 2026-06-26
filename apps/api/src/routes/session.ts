// apps/api — GET /session reflects the current identity (DC2) or anonymous, so apps/web can gate UI.
// The server stays authoritative; UI gating is never the access control (FE-INV-10 / BE-INV-6).
import type { FastifyPluginAsync } from 'fastify';
import type { domain, dto } from '@quad/core';
import type { PlacementRepository } from '@quad/db';

export function makeSessionRoutes(repo: PlacementRepository): FastifyPluginAsync {
  return async (app) => {
    app.get('/api/v1/session', async (request, reply) => {
      void reply.header('Cache-Control', 'no-store'); // per-user auth state must never be cached
      if (!request.tenant) {
        const body: dto.ErrorResponse = { error: { code: 'NOT_FOUND', message: 'No tenant for this host.', requestId: request.id } };
        return reply.status(404).send(body);
      }
      const principal = request.principal;
      if (!principal) {
        const anonymous: dto.SessionResponse = { authenticated: false };
        return reply.send(anonymous);
      }
      const identity = await repo.getPublicIdentity(principal.userId);
      if (!identity) {
        const response: dto.SessionResponse = { authenticated: true, role: principal.role };
        return reply.send(response);
      }
      const user: domain.PublicIdentity =
        identity.displayName !== undefined
          ? { handle: identity.handle as domain.PublicHandle, displayName: identity.displayName }
          : { handle: identity.handle as domain.PublicHandle };
      const response: dto.SessionResponse = { authenticated: true, user, role: principal.role };
      return reply.send(response);
    });
  };
}
