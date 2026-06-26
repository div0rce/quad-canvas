// apps/api — pixel placement + read routes. The POST endpoint is the hot write path; it requires
// tenant context + a verified principal (no anonymous writes) and delegates the decision to the
// placement domain service. The GET endpoint reads the current-canvas projection (DC2 only).
// Built as a factory over the placement deps, so the routes are only mounted when a database is
// configured (the deps are captured, not read off a possibly-undefined instance decoration).
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { domain, dto } from '@quad/core';
import { placePixel } from '../services/placement.js';
import type { PlacementDeps, PlacementInput } from '../services/placement.js';

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

export function makePixelRoutes(placement: PlacementDeps): FastifyPluginAsync {
  return async (app) => {
    // Placement command (write). Tenant + verified principal required.
    app.post('/api/v1/canvas/current/pixels', async (request, reply) => {
      if (!request.tenant) return sendError(reply, request, 'NOT_FOUND', 'No tenant for this host.');
      if (!request.principal) return sendError(reply, request, 'UNAUTHENTICATED', 'Authentication required.');

      const key = request.headers['idempotency-key'];
      const idempotencyKey = typeof key === 'string' ? key : '';
      const body = (request.body ?? {}) as Partial<dto.PlacePixelCommand>;
      const at = body.at;
      const color = body.color;
      if (!at || typeof at.x !== 'number' || typeof at.y !== 'number' || typeof color !== 'number') {
        return sendError(reply, request, 'VALIDATION_ERROR', 'Body must be { at: { x, y }, color }.');
      }

      const input: PlacementInput = { x: at.x, y: at.y, color, idempotencyKey };
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
      const canvas = await placement.repo.findCurrentCanvas(request.tenant.id);
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
  };
}
