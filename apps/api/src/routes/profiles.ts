// apps/api — profiles. `/me` returns the caller's own profile (participant-gated); `/{handle}` is a
// public DC2 profile for any active member of the tenant. DC2 only (handle/display/role/stats) —
// never the email. The static `/me` route is registered before the `:handle` param route so it wins.
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { domain, dto } from '@quad/core';
import type { PlacementRepository, ProfileRecentPlacementRow, ProfileRow, ProfileStatsRow } from '@quad/db';

function err(reply: FastifyReply, request: FastifyRequest, status: number, code: dto.ErrorCode, message: string): FastifyReply {
  const body: dto.ErrorResponse = { error: { code, message, requestId: request.id } };
  return reply.status(status).send(body);
}

function toStats(row: ProfileStatsRow): dto.ProfileStats {
  return {
    pixelsPlaced: row.pixelsPlaced,
    survivingPixels: row.survivingPixels,
    streakDays: row.streakDays,
    longestStreakDays: row.longestStreakDays,
    canvasesParticipated: row.canvasesParticipated,
    ...(row.favoriteColor !== null ? { favoriteColor: row.favoriteColor } : {}),
  };
}

function toRecentPlacement(row: ProfileRecentPlacementRow): dto.ProfileRecentPlacement {
  return {
    id: row.id,
    term: row.term,
    at: { x: row.x, y: row.y },
    color: row.color,
    placedAt: row.placedAt.toISOString(),
    surviving: row.surviving,
  };
}

function toResponse(row: ProfileRow): dto.ProfileResponse {
  return {
    handle: row.handle,
    role: row.role as domain.Role,
    joinedAt: row.joinedAt.toISOString(),
    pixelsPlaced: row.pixelsPlaced,
    currentTermPixelsPlaced: row.currentTermPixelsPlaced,
    contributions: row.contributions.map((c) => ({ date: c.date, count: c.count })),
    lifetimeStats: toStats(row.lifetimeStats),
    currentTermStats: toStats(row.currentTermStats),
    recentPlacements: row.recentPlacements.map(toRecentPlacement),
    ...(row.displayName !== null ? { displayName: row.displayName } : {}),
    ...(row.activeGuild !== null
      ? {
          activeGuild: {
            slug: row.activeGuild.slug,
            name: row.activeGuild.name,
            guildPixels: row.activeGuild.guildPixels,
            placerRank: row.activeGuild.placerRank,
          },
        }
      : {}),
  };
}

export function makeProfileRoutes(repo: PlacementRepository): FastifyPluginAsync {
  return async (app) => {
    app.get('/api/v1/profiles/me', async (request, reply) => {
      if (!request.tenant) return err(reply, request, 404, 'NOT_FOUND', 'No tenant for this host.');
      const principal = request.principal;
      if (!principal) return err(reply, request, 401, 'UNAUTHENTICATED', 'Authentication required.');
      const row = await repo.getProfileByUserId(request.tenant.id, principal.userId);
      if (!row) return err(reply, request, 404, 'NOT_FOUND', 'No profile for this member.');
      void reply.header('Cache-Control', 'private, no-store'); // caller-specific
      return reply.send(toResponse(row));
    });

    app.post('/api/v1/profiles/me', async (request, reply) => {
      if (!request.tenant) return err(reply, request, 404, 'NOT_FOUND', 'No tenant for this host.');
      const principal = request.principal;
      if (!principal) return err(reply, request, 401, 'UNAUTHENTICATED', 'Authentication required.');
      const body = (request.body ?? {}) as Partial<dto.UpdateProfileCommand>;
      if (body.handle === undefined && body.displayName === undefined) {
        return err(reply, request, 422, 'VALIDATION_ERROR', 'Nothing to update.');
      }
      if (body.handle !== undefined && typeof body.handle !== 'string') {
        return err(reply, request, 422, 'VALIDATION_ERROR', 'handle must be a string.');
      }
      if (body.displayName !== undefined && typeof body.displayName !== 'string') {
        return err(reply, request, 422, 'VALIDATION_ERROR', 'displayName must be a string.');
      }
      const result = await repo.updateProfile({
        tenantId: request.tenant.id,
        userId: principal.userId,
        ...(body.handle !== undefined ? { handle: body.handle } : {}),
        ...(body.displayName !== undefined ? { displayName: body.displayName.trim() === '' ? null : body.displayName.trim() } : {}),
      });
      if (result.kind === 'invalid_handle') {
        return err(reply, request, 422, 'VALIDATION_ERROR', 'A handle must be 3–24 letters, numbers, underscores, or hyphens.');
      }
      if (result.kind === 'handle_taken') return err(reply, request, 409, 'CONFLICT', 'That handle is already taken.');
      return reply.send({ handle: result.handle } satisfies dto.UpdateProfileResponse);
    });

    app.get('/api/v1/profiles/:handle', async (request, reply) => {
      if (!request.tenant) return err(reply, request, 404, 'NOT_FOUND', 'No tenant for this host.');
      const { handle } = request.params as { handle: string };
      const row = await repo.getProfileByHandle(request.tenant.id, handle);
      if (!row) return err(reply, request, 404, 'NOT_FOUND', 'No such profile in this tenant.');
      void reply.header('Cache-Control', 'public, max-age=60'); // eventually-consistent stats
      return reply.send(toResponse(row));
    });
  };
}
