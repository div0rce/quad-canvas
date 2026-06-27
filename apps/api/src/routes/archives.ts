// apps/api — archives (past terms). Public, tenant-resolved, read-only metadata. Archives are
// immutable, so responses are strongly cacheable. Replay artifact pointers (object storage) are a
// follow-on; this is the list + per-term metadata half.
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { domain, dto } from '@quad/core';
import type { PlacementRepository } from '@quad/db';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const CACHE = 'public, max-age=300';

function clampLimit(raw: unknown): number {
  const n = typeof raw === 'string' ? Number(raw) : NaN;
  if (!Number.isInteger(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

function err(reply: FastifyReply, request: FastifyRequest, status: number, code: dto.ErrorCode, message: string): FastifyReply {
  const body: dto.ErrorResponse = { error: { code, message, requestId: request.id } };
  return reply.status(status).send(body);
}

export function makeArchiveRoutes(repo: PlacementRepository): FastifyPluginAsync {
  return async (app) => {
    app.get('/api/v1/archives', async (request, reply) => {
      if (!request.tenant) return err(reply, request, 404, 'NOT_FOUND', 'No tenant for this host.');
      const query = request.query as { cursor?: string; limit?: string };
      const limit = clampLimit(query.limit);
      const page = await repo.listArchives(request.tenant.id, {
        limit,
        ...(typeof query.cursor === 'string' ? { cursor: query.cursor } : {}),
      });
      const response: dto.ArchiveListResponse = {
        data: page.items.map((a) => ({
          id: a.id,
          term: a.term,
          status: a.status,
          width: a.width,
          height: a.height,
          createdAt: a.createdAt.toISOString(),
        })),
        page: { nextCursor: page.nextCursor, limit },
      };
      void reply.header('Cache-Control', CACHE);
      return reply.send(response);
    });

    app.get('/api/v1/archives/:term', async (request, reply) => {
      if (!request.tenant) return err(reply, request, 404, 'NOT_FOUND', 'No tenant for this host.');
      const { term } = request.params as { term: string };
      const archive = await repo.findArchiveByTerm(request.tenant.id, term);
      if (!archive) return err(reply, request, 404, 'NOT_FOUND', 'No archive for that term.');
      const response: dto.ArchiveResponse = {
        id: archive.id,
        term: archive.term,
        status: archive.status,
        width: archive.width,
        height: archive.height,
        createdAt: archive.createdAt.toISOString(),
      };
      void reply.header('Cache-Control', CACHE);
      return reply.send(response);
    });

    app.get('/api/v1/archives/:term/replay', async (request, reply) => {
      if (!request.tenant) return err(reply, request, 404, 'NOT_FOUND', 'No tenant for this host.');
      const { term } = request.params as { term: string };
      const meta = await repo.getReplayMeta(request.tenant.id, term);
      if (!meta) return err(reply, request, 404, 'NOT_FOUND', 'No archive for that term.');
      const response: dto.ReplayMetaResponse = {
        term,
        eventCount: meta.eventCount,
        fromSeq: meta.fromSeq,
        toSeq: meta.toSeq,
        available: false, // pre-rendered assets (object storage) are a follow-on
      };
      void reply.header('Cache-Control', CACHE);
      return reply.send(response);
    });

    // The archived term's FINAL canvas state (its retained projection) — view a completed term.
    app.get('/api/v1/archives/:term/snapshot', async (request, reply) => {
      if (!request.tenant) return err(reply, request, 404, 'NOT_FOUND', 'No tenant for this host.');
      const { term } = request.params as { term: string };
      const archive = await repo.findArchiveByTerm(request.tenant.id, term);
      if (!archive) return err(reply, request, 404, 'NOT_FOUND', 'No archive for that term.');
      const snap = await repo.getSnapshot(archive.id);
      const response: dto.CanvasSnapshotResponse = {
        width: archive.width,
        height: archive.height,
        seq: snap.seq as domain.PerCanvasSequence,
        cells: snap.cells.map((c) => ({ x: c.x, y: c.y, color: c.color as domain.ColorIndex })),
      };
      void reply.header('Cache-Control', CACHE); // immutable archive
      return reply.send(response);
    });
  };
}
