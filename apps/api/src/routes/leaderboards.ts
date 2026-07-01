// apps/api — leaderboards. Public, tenant-resolved, DC2 ranked lists. category + window are
// allow-listed (never arbitrary client filters); unknown values are 422. Eventually consistent, so
// a short public cache is fine. Served from the placement projection/log (placement counts).
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { dto } from '@quad/core';
import type { PlacementRepository } from '@quad/db';

const CATEGORIES = new Set<string>(['placements', 'surviving']);
const WINDOWS = new Set<string>(['all', 'today']);
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function clampLimit(raw: unknown): number {
  const n = typeof raw === 'string' ? Number(raw) : NaN;
  if (!Number.isInteger(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

function err(reply: FastifyReply, request: FastifyRequest, status: number, code: dto.ErrorCode, message: string): FastifyReply {
  const body: dto.ErrorResponse = { error: { code, message, requestId: request.id } };
  return reply.status(status).send(body);
}

export function makeLeaderboardRoutes(repo: PlacementRepository): FastifyPluginAsync {
  return async (app) => {
    app.get('/api/v1/leaderboards', async (request, reply) => {
      if (!request.tenant) return err(reply, request, 404, 'NOT_FOUND', 'No tenant for this host.');
      const q = request.query as { category?: string; window?: string; limit?: string };
      const category = q.category ?? 'placements';
      const window = q.window ?? 'all';
      if (!CATEGORIES.has(category) || !WINDOWS.has(window)) {
        return err(reply, request, 422, 'VALIDATION_ERROR', 'Unsupported leaderboard category or window.');
      }
      const limit = clampLimit(q.limit);
      const rows = await repo.getLeaderboard(request.tenant.id, {
        category: category as 'placements' | 'surviving',
        window: window as 'all' | 'today',
        limit,
      });
      const response: dto.LeaderboardResponse = {
        category,
        window,
        entries: rows.map((r, i) => ({
          rank: i + 1,
          handle: r.handle,
          score: r.score,
          pixelsPlaced: r.pixelsPlaced,
          survivingPixels: r.survivingPixels,
          ...(r.displayName !== null ? { displayName: r.displayName } : {}),
        })),
      };
      void reply.header('Cache-Control', 'public, max-age=30');
      return reply.send(response);
    });
  };
}
