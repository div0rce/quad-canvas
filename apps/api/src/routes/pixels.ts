// apps/api — pixel placement + read routes. The POST endpoint is the hot write path; it requires
// tenant context + a verified principal (no anonymous writes) and delegates the decision to the
// placement domain service. The GET endpoint reads the current-canvas projection (DC2 only).
// Built as a factory over the placement deps, so the routes are only mounted when a database is
// configured (the deps are captured, not read off a possibly-undefined instance decoration).
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { domain, dto } from '@quad/core';
import { placePixel } from '../services/placement.js';
import type { PlacementDeps, PlacementInput } from '../services/placement.js';
import { readIdempotencyKey } from './idempotency.js';

/** A preHandler hook (e.g. the rate limiter). */
type PreHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

const STATUS: Record<dto.ErrorCode, number> = {
  VALIDATION_ERROR: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  COOLDOWN_ACTIVE: 429,
  RATE_LIMITED: 429,
  TENANT_MISMATCH: 403,
  INTERNAL: 500,
};

function sendError(
  reply: FastifyReply,
  request: FastifyRequest,
  code: dto.ErrorCode,
  message: string,
  details?: Record<string, unknown>,
): FastifyReply {
  const body: dto.ErrorResponse = {
    error: details ? { code, message, requestId: request.id, details } : { code, message, requestId: request.id },
  };
  const retry = details?.['retryAfterMs'];
  if (code === 'COOLDOWN_ACTIVE' && typeof retry === 'number') {
    void reply.header('Retry-After', Math.ceil(retry / 1000));
  }
  return reply.status(STATUS[code]).send(body);
}

const DEFAULT_HISTORY_LIMIT = 50;
const MAX_HISTORY_LIMIT = 200;
const DEFAULT_RECENT_LIMIT = 5;
const MAX_RECENT_LIMIT = 20;

function clampLimit(raw: unknown): number {
  const n = typeof raw === 'string' ? Number(raw) : NaN;
  if (!Number.isInteger(n) || n <= 0) return DEFAULT_HISTORY_LIMIT;
  return Math.min(n, MAX_HISTORY_LIMIT);
}

function clampRecentLimit(raw: unknown): number {
  const n = typeof raw === 'string' ? Number(raw) : NaN;
  if (!Number.isInteger(n) || n <= 0) return DEFAULT_RECENT_LIMIT;
  return Math.min(n, MAX_RECENT_LIMIT);
}

export function makePixelRoutes(placement: PlacementDeps, rateLimit?: PreHandler): FastifyPluginAsync {
  return async (app) => {
    // Placement command (write). Tenant + verified principal required.
    app.post('/api/v1/canvas/current/pixels', rateLimit ? { preHandler: rateLimit } : {}, async (request, reply) => {
      if (!request.tenant) return sendError(reply, request, 'NOT_FOUND', 'No tenant for this host.');
      if (!request.principal) return sendError(reply, request, 'UNAUTHENTICATED', 'Authentication required.');

      const idempotency = readIdempotencyKey(request);
      if (!idempotency.ok) return sendError(reply, request, 'VALIDATION_ERROR', idempotency.message);
      const body = (request.body ?? {}) as Partial<dto.PlacePixelCommand>;
      const at = body.at;
      const color = body.color;
      if (!at || typeof at.x !== 'number' || typeof at.y !== 'number' || typeof color !== 'number') {
        return sendError(reply, request, 'VALIDATION_ERROR', 'Body must be { at: { x, y }, color }.');
      }

      const input: PlacementInput = { x: at.x, y: at.y, color, idempotencyKey: idempotency.key };
      const outcome = await placePixel(
        placement,
        request.principal,
        { id: request.tenant.id, palette: request.tenant.palette },
        input,
      );
      if (!outcome.ok) return sendError(reply, request, outcome.error.code, outcome.error.message, outcome.error.details);
      return reply.status(201).send(outcome.result);
    });

    // Single-cell read of the current-canvas projection (public; DC2 attribution only).
    app.get('/api/v1/canvas/current/pixels/:x/:y', async (request, reply) => {
      if (!request.tenant) return sendError(reply, request, 'NOT_FOUND', 'No tenant for this host.');
      const params = request.params as { x: string; y: string };
      const x = Number(params.x);
      const y = Number(params.y);
      if (!Number.isInteger(x) || !Number.isInteger(y)) {
        return sendError(reply, request, 'VALIDATION_ERROR', 'Coordinates must be integers.');
      }
      const canvas = await placement.repo.findViewableCanvas(request.tenant.id);
      if (!canvas) return sendError(reply, request, 'NOT_FOUND', 'No current canvas.');
      if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) {
        return sendError(reply, request, 'NOT_FOUND', 'Coordinate is out of canvas bounds.');
      }
      const pixel = await placement.repo.getPixel(canvas.id, x, y);
      if (!pixel) return sendError(reply, request, 'NOT_FOUND', 'Pixel has not been placed.');

      const response: dto.PixelResponse = {
        at: { x: pixel.x, y: pixel.y },
        color: pixel.color as domain.ColorIndex,
        ...(pixel.ownerHandle ? { owner: { handle: pixel.ownerHandle } } : {}),
        placedAt: pixel.placedAt.toISOString(),
      };
      return reply.send(response);
    });

    // Current-canvas metadata (public): term/status/dimensions/palette for the initial load.
    app.get('/api/v1/canvas/current', async (request, reply) => {
      if (!request.tenant) return sendError(reply, request, 'NOT_FOUND', 'No tenant for this host.');
      const canvas = await placement.repo.findViewableCanvas(request.tenant.id);
      if (!canvas) return sendError(reply, request, 'NOT_FOUND', 'No current canvas.');
      const meta: dto.CanvasMetaResponse = {
        id: canvas.id as domain.CanvasId,
        term: canvas.termLabel,
        status: canvas.status,
        width: canvas.width,
        height: canvas.height,
        palette: request.tenant.palette,
      };
      return reply.send(meta);
    });

    // Current-canvas snapshot (public): the projection for initial paint (deltas come over WS).
    app.get('/api/v1/canvas/current/snapshot', async (request, reply) => {
      if (!request.tenant) return sendError(reply, request, 'NOT_FOUND', 'No tenant for this host.');
      const canvas = await placement.repo.findViewableCanvas(request.tenant.id);
      if (!canvas) return sendError(reply, request, 'NOT_FOUND', 'No current canvas.');
      const snap = await placement.repo.getSnapshot(canvas.id);
      const snapshot: dto.CanvasSnapshotResponse = {
        width: canvas.width,
        height: canvas.height,
        seq: snap.seq as domain.PerCanvasSequence,
        cells: snap.cells.map((c) => ({ x: c.x, y: c.y, color: c.color as domain.ColorIndex })),
      };
      return reply.send(snapshot);
    });

    // Current-canvas recent placement feed (public; DC2 attribution only), used to recover missed
    // live events after an inactive/throttled tab resumes.
    app.get('/api/v1/canvas/current/placements/recent', async (request, reply) => {
      if (!request.tenant) return sendError(reply, request, 'NOT_FOUND', 'No tenant for this host.');
      const canvas = await placement.repo.findViewableCanvas(request.tenant.id);
      if (!canvas) return sendError(reply, request, 'NOT_FOUND', 'No current canvas.');
      const query = request.query as { limit?: string };
      const rows = await placement.repo.listRecentCanvasPlacements(canvas.id, clampRecentLimit(query.limit));
      const response: dto.CanvasRecentPlacementsResponse = {
        data: rows.map((row) => ({
          at: { x: row.x, y: row.y },
          color: row.color as domain.ColorIndex,
          seq: row.seq as domain.PerCanvasSequence,
          ...(row.ownerHandle
            ? {
                owner:
                  row.ownerDisplayName !== null
                    ? { handle: row.ownerHandle as domain.PublicHandle, displayName: row.ownerDisplayName }
                    : { handle: row.ownerHandle as domain.PublicHandle },
              }
            : {}),
          placedAt: row.placedAt.toISOString(),
        })),
      };
      void reply.header('Cache-Control', 'public, max-age=5');
      return reply.send(response);
    });

    // Per-cell placement history (public; DC2 attribution; cursor-paginated, oldest→newest).
    app.get('/api/v1/canvas/current/pixels/:x/:y/history', async (request, reply) => {
      if (!request.tenant) return sendError(reply, request, 'NOT_FOUND', 'No tenant for this host.');
      const params = request.params as { x: string; y: string };
      const x = Number(params.x);
      const y = Number(params.y);
      if (!Number.isInteger(x) || !Number.isInteger(y)) {
        return sendError(reply, request, 'VALIDATION_ERROR', 'Coordinates must be integers.');
      }
      const canvas = await placement.repo.findViewableCanvas(request.tenant.id);
      if (!canvas) return sendError(reply, request, 'NOT_FOUND', 'No current canvas.');
      if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) {
        return sendError(reply, request, 'NOT_FOUND', 'Coordinate is out of canvas bounds.');
      }
      const query = request.query as { cursor?: string; limit?: string };
      const limit = clampLimit(query.limit);
      const rawCursor = typeof query.cursor === 'string' ? Number(query.cursor) : NaN;
      const cursor = Number.isInteger(rawCursor) ? rawCursor : undefined;
      const pageData = await placement.repo.getPixelHistory(canvas.id, x, y, {
        limit,
        ...(cursor !== undefined ? { cursor } : {}),
      });
      const response: dto.PixelHistoryListResponse = {
        data: pageData.entries.map((e) => ({
          color: e.color as domain.ColorIndex,
          seq: e.seq as domain.PerCanvasSequence,
          ...(e.ownerHandle ? { owner: { handle: e.ownerHandle } } : {}),
          placedAt: e.placedAt.toISOString(),
        })),
        page: { nextCursor: pageData.nextCursor !== null ? String(pageData.nextCursor) : null, limit },
      };
      return reply.send(response);
    });
  };
}
