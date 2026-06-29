// apps/api — user reports + the moderation queue. Filing is participant-gated (no anonymous
// reports); the queue is moderator-gated. Reports are DC4 truth feeding moderation; the queue
// exposes the report content, not the reporter's identity, at this level.
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { dto } from '@quad/core';
import type { PlacementRepository, ListReportsQuery } from '@quad/db';
import { requireRole } from '../auth/roles.js';
import { readIdempotencyKey } from './idempotency.js';

/** A preHandler hook (e.g. the rate limiter). */
type PreHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function clampLimit(raw: unknown): number {
  const n = typeof raw === 'string' ? Number(raw) : NaN;
  if (!Number.isInteger(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

function err(reply: FastifyReply, request: FastifyRequest, status: number, code: dto.ErrorCode, message: string): FastifyReply {
  const body: dto.ErrorResponse = { error: { code, message, requestId: request.id } };
  return reply.status(status).send(body);
}

export function makeReportRoutes(repo: PlacementRepository, rateLimit?: PreHandler): FastifyPluginAsync {
  // Rate limit runs before the role gate so report spam is throttled per filer.
  const filePreHandlers = rateLimit ? [rateLimit, requireRole('participant')] : requireRole('participant');
  return async (app) => {
    app.post('/api/v1/reports', { preHandler: filePreHandlers }, async (request, reply) => {
      const principal = request.principal;
      if (!request.tenant || !principal) return err(reply, request, 401, 'UNAUTHENTICATED', 'Authentication required.');
      const idempotency = readIdempotencyKey(request);
      if (!idempotency.ok) return err(reply, request, 422, 'VALIDATION_ERROR', idempotency.message);
      const body = (request.body ?? {}) as Partial<dto.SubmitReportCommand>;
      if (typeof body.targetRef !== 'string' || typeof body.reason !== 'string' || body.reason.trim() === '') {
        return err(reply, request, 422, 'VALIDATION_ERROR', 'targetRef and a non-empty reason are required.');
      }
      const canvas = await repo.findViewableCanvas(request.tenant.id);
      const report = await repo.createReport({
        tenantId: request.tenant.id,
        canvasId: canvas?.id ?? null,
        reporterUserId: principal.userId,
        targetRef: body.targetRef,
        reason: body.reason,
        idempotencyKey: idempotency.key,
      });
      if (report.kind === 'idempotency_conflict') {
        return err(reply, request, 409, 'CONFLICT', 'Idempotency-Key was already used for a different report.');
      }
      const response: dto.ReportResponse = { id: report.id, status: report.status };
      return reply.status(201).send(response);
    });

    app.get('/api/v1/moderation/reports', { preHandler: requireRole('moderator') }, async (request, reply) => {
      if (!request.tenant) return err(reply, request, 404, 'NOT_FOUND', 'No tenant for this host.');
      const query = request.query as { status?: string; cursor?: string; limit?: string };
      const limit = clampLimit(query.limit);
      const listQuery: ListReportsQuery = {
        limit,
        ...(typeof query.status === 'string' ? { status: query.status } : {}),
        ...(typeof query.cursor === 'string' ? { cursor: query.cursor } : {}),
      };
      const page = await repo.listReports(request.tenant.id, listQuery);
      const response: dto.ReportQueueResponse = {
        data: page.items.map((r) => ({
          id: r.id,
          targetRef: r.targetRef,
          reason: r.reason,
          status: r.status,
          createdAt: r.createdAt.toISOString(),
        })),
        page: { nextCursor: page.nextCursor, limit },
      };
      return reply.send(response);
    });
  };
}
