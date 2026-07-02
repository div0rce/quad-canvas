// apps/api — guilds. Social/identity grouping within a tenant: directory, profile, create, and
// join/leave/set-active. Member-gated + tenant-scoped; DC2 only. A guild confers NO placement
// advantage (fairness invariant) — it is a team badge, not power.
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { domain, dto } from '@quad/core';
import type { GuildDetailRow, GuildSummaryRow, PlacementRepository } from '@quad/db';
import { requireRole } from '../auth/roles.js';

const MAX_NAME = 48;
const MAX_DESCRIPTION = 280;

function err(reply: FastifyReply, request: FastifyRequest, status: number, code: dto.ErrorCode, message: string): FastifyReply {
  const body: dto.ErrorResponse = { error: { code, message, requestId: request.id } };
  return reply.status(status).send(body);
}

function toSummary(row: GuildSummaryRow): dto.GuildSummary {
  return {
    slug: row.slug,
    name: row.name,
    memberCount: row.memberCount,
    joined: row.joined,
    active: row.active,
    ...(row.description !== null ? { description: row.description } : {}),
  };
}

function toDetail(row: GuildDetailRow): dto.GuildDetailResponse {
  return {
    ...toSummary(row),
    members: row.members.map((m) => ({
      handle: m.handle,
      role: m.role as domain.Role,
      ...(m.displayName !== null ? { displayName: m.displayName } : {}),
    })),
  };
}

export function makeGuildRoutes(repo: PlacementRepository): FastifyPluginAsync {
  const member = { preHandler: requireRole('participant') };
  return async (app) => {
    app.get('/api/v1/guilds', member, async (request, reply) => {
      const principal = request.principal;
      if (!request.tenant || !principal) return err(reply, request, 401, 'UNAUTHENTICATED', 'Authentication required.');
      const rows = await repo.listGuilds(request.tenant.id, principal.userId);
      void reply.header('Cache-Control', 'private, no-store');
      return reply.send({ guilds: rows.map(toSummary) } satisfies dto.GuildsResponse);
    });

    app.get('/api/v1/guilds/:slug', member, async (request, reply) => {
      const principal = request.principal;
      if (!request.tenant || !principal) return err(reply, request, 401, 'UNAUTHENTICATED', 'Authentication required.');
      const { slug } = request.params as { slug: string };
      const row = await repo.getGuild(request.tenant.id, principal.userId, slug);
      if (!row) return err(reply, request, 404, 'NOT_FOUND', 'No such guild.');
      void reply.header('Cache-Control', 'private, no-store');
      return reply.send(toDetail(row));
    });

    app.post('/api/v1/guilds', member, async (request, reply) => {
      const principal = request.principal;
      if (!request.tenant || !principal) return err(reply, request, 401, 'UNAUTHENTICATED', 'Authentication required.');
      const body = (request.body ?? {}) as Partial<dto.CreateGuildCommand>;
      if (typeof body.name !== 'string' || body.name.trim() === '' || body.name.length > MAX_NAME) {
        return err(reply, request, 422, 'VALIDATION_ERROR', `A guild name (1–${MAX_NAME} chars) is required.`);
      }
      if (body.description !== undefined && (typeof body.description !== 'string' || body.description.length > MAX_DESCRIPTION)) {
        return err(reply, request, 422, 'VALIDATION_ERROR', `A description must be at most ${MAX_DESCRIPTION} characters.`);
      }
      const description = typeof body.description === 'string' && body.description.trim() !== '' ? body.description.trim() : null;
      const result = await repo.createGuild({ tenantId: request.tenant.id, userId: principal.userId, name: body.name, description });
      switch (result.kind) {
        case 'invalid':
          return err(reply, request, 422, 'VALIDATION_ERROR', 'That name has no usable letters or numbers.');
        case 'duplicate':
          return err(reply, request, 409, 'CONFLICT', 'A guild with that name already exists.');
        case 'created':
          return reply.status(201).send({ slug: result.slug });
      }
    });

    const membershipAction = (
      path: string,
      run: (tenantId: string, userId: string, slug: string) => Promise<{ kind: 'ok' | 'not_found' }>,
      notFound: string,
    ): void => {
      app.post(path, member, async (request, reply) => {
        const principal = request.principal;
        if (!request.tenant || !principal) return err(reply, request, 401, 'UNAUTHENTICATED', 'Authentication required.');
        const { slug } = request.params as { slug: string };
        const result = await run(request.tenant.id, principal.userId, slug);
        if (result.kind === 'not_found') return err(reply, request, 404, 'NOT_FOUND', notFound);
        return reply.send({ ok: true });
      });
    };

    membershipAction('/api/v1/guilds/:slug/join', (t, u, s) => repo.joinGuild(t, u, s), 'No such guild.');
    membershipAction('/api/v1/guilds/:slug/leave', (t, u, s) => repo.leaveGuild(t, u, s), 'You are not in that guild.');
    membershipAction('/api/v1/guilds/:slug/active', (t, u, s) => repo.setActiveGuild(t, u, s), 'Join the guild before making it active.');
  };
}
