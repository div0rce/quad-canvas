// apps/api — moderation actions (moderator+). Reversible, role-scoped, and AUDITED: the status
// change + the append-only moderation_actions record commit ATOMICALLY (no action without an audit,
// P-MOD-4); there is no hard delete (MODERATION.md / API.md §19). Destructive actions need a higher
// role (ban → admin), a moderator can only act on members of a LOWER role, and a reason is required.
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { domain, dto, ws } from '@quad/core';
import type { PlacementRepository } from '@quad/db';
import type { RealtimeBus } from '@quad/realtime';
import type { SessionStore } from '../auth/session-store.js';
import { requireRole, hasMinRole } from '../auth/roles.js';

function parseCoords(targetRef: string): { x: number; y: number } | null {
  const parts = targetRef.split(',');
  if (parts.length !== 2) return null;
  const x = Number(parts[0]);
  const y = Number(parts[1]);
  if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
  return { x, y };
}

// Bounded so the per-cell rollback loop holds the per-canvas advisory lock only briefly (a larger
// sweep is several calls, or a future batched implementation). Each cell does a few queries.
const MAX_REGION_CELLS = 1024;

function parseRegion(targetRef: string): { x1: number; y1: number; x2: number; y2: number } | null {
  const parts = targetRef.split(',').map(Number);
  if (parts.length !== 4 || !parts.every(Number.isInteger)) return null;
  const [x1, y1, x2, y2] = parts as [number, number, number, number];
  if (x1 < 0 || y1 < 0 || x2 < x1 || y2 < y1) return null;
  return { x1, y1, x2, y2 };
}

const MEMBER_ACTIONS: Record<string, { status: 'suspended' | 'banned' | 'active'; minRole: domain.Role }> = {
  suspend_member: { status: 'suspended', minRole: 'moderator' },
  ban_member: { status: 'banned', minRole: 'admin' },
  reinstate_member: { status: 'active', minRole: 'moderator' },
};

// Report-queue actions (moderator-level): `targetRef` is the report id. `reopen_report` reverses a
// resolve/dismiss (P-AC-10: triage is reversible) — it sets the report back to `open` and is audited.
const REPORT_ACTIONS: Record<string, 'resolved' | 'dismissed' | 'open'> = {
  resolve_report: 'resolved',
  dismiss_report: 'dismissed',
  reopen_report: 'open',
};

function err(reply: FastifyReply, request: FastifyRequest, status: number, code: dto.ErrorCode, message: string): FastifyReply {
  const body: dto.ErrorResponse = { error: { code, message, requestId: request.id } };
  return reply.status(status).send(body);
}

export function makeModerationRoutes(repo: PlacementRepository, sessions: SessionStore, bus: RealtimeBus): FastifyPluginAsync {
  return async (app) => {
    app.post('/api/v1/moderation/actions', { preHandler: requireRole('moderator') }, async (request, reply) => {
      const principal = request.principal;
      if (!request.tenant || !principal) return err(reply, request, 401, 'UNAUTHENTICATED', 'Authentication required.');

      const body = (request.body ?? {}) as Partial<dto.ModerationActionCommand>;
      if (typeof body.actionType !== 'string' || typeof body.targetRef !== 'string') {
        return err(reply, request, 422, 'VALIDATION_ERROR', 'actionType and targetRef are required.');
      }
      if (typeof body.reason !== 'string' || body.reason.trim() === '') {
        return err(reply, request, 422, 'VALIDATION_ERROR', 'A reason is required for every moderation action.');
      }
      const memberAction = MEMBER_ACTIONS[body.actionType];
      const reportStatus = REPORT_ACTIONS[body.actionType];

      if (memberAction) {
        // Destructive actions need a higher role than the base moderator gate.
        if (!hasMinRole(principal.role, memberAction.minRole)) {
          return err(reply, request, 403, 'FORBIDDEN', 'Insufficient role for this action.');
        }
        const targetRole = await repo.getMembershipRole(request.tenant.id, body.targetRef);
        if (targetRole === null) return err(reply, request, 404, 'NOT_FOUND', 'Target is not a member of this tenant.');
        // A moderator may not act on a peer or a higher role.
        if (hasMinRole(targetRole as domain.Role, principal.role)) {
          return err(reply, request, 403, 'FORBIDDEN', 'Cannot moderate a member of equal or higher role.');
        }
        const result = await repo.applyMemberModeration({
          tenantId: request.tenant.id,
          actorUserId: principal.userId,
          targetUserId: body.targetRef,
          actionType: body.actionType,
          status: memberAction.status,
          reason: body.reason,
        });
        if (!result.updated) return err(reply, request, 404, 'NOT_FOUND', 'Target is not a member of this tenant.');
        // Suspend/ban revokes ALL of the target's sessions immediately (AUTH-INV-8).
        if (memberAction.status !== 'active') await sessions.revokeAllForUser(body.targetRef);
        const response: dto.ModerationActionResponse = {
          id: result.auditId,
          actionType: body.actionType,
          createdAt: result.createdAt.toISOString(),
        };
        return reply.status(200).send(response);
      }

      if (reportStatus) {
        const result = await repo.resolveReport({
          tenantId: request.tenant.id,
          actorUserId: principal.userId,
          reportId: body.targetRef,
          status: reportStatus,
          actionType: body.actionType,
          reason: body.reason,
        });
        if (!result.updated) return err(reply, request, 404, 'NOT_FOUND', 'Report not found in this tenant.');
        const response: dto.ModerationActionResponse = {
          id: result.auditId,
          actionType: body.actionType,
          createdAt: result.createdAt.toISOString(),
        };
        return reply.status(200).send(response);
      }

      if (body.actionType === 'pixel_rollback') {
        const coords = parseCoords(body.targetRef);
        if (!coords) return err(reply, request, 422, 'VALIDATION_ERROR', 'targetRef must be "x,y" for a pixel rollback.');
        const canvas = await repo.findViewableCanvas(request.tenant.id);
        if (!canvas) return err(reply, request, 404, 'NOT_FOUND', 'No canvas for this tenant.');
        // An archived canvas is sealed — no new events may mutate it, even via moderation.
        if (canvas.status === 'archived') return err(reply, request, 409, 'CONFLICT', 'Cannot modify an archived canvas.');
        // Bounds-check against the canvas (like region_rollback) — an out-of-range coordinate would
        // otherwise overflow the Int column and 500 instead of returning a clean 422.
        if (coords.x < 0 || coords.y < 0 || coords.x >= canvas.width || coords.y >= canvas.height) {
          return err(reply, request, 422, 'VALIDATION_ERROR', 'Coordinate is out of canvas bounds.');
        }
        const result = await repo.rollbackPixel({
          tenantId: request.tenant.id,
          canvasId: canvas.id,
          actorUserId: principal.userId,
          x: coords.x,
          y: coords.y,
          reason: body.reason,
        });
        if (result.kind === 'archived') return err(reply, request, 409, 'CONFLICT', 'Cannot modify an archived canvas.');
        if (result.kind === 'absent') return err(reply, request, 404, 'NOT_FOUND', 'No pixel at that coordinate to roll back.');
        const message: ws.PixelRolledBack = {
          type: 'PixelRolledBack',
          at: { x: coords.x, y: coords.y },
          seq: result.seq as domain.PerCanvasSequence,
          ...(result.color !== null ? { color: result.color as domain.ColorIndex } : {}),
        };
        try {
          await bus.publish(request.tenant.id, canvas.id, message);
        } catch {
          // best-effort broadcast
        }
        const response: dto.ModerationActionResponse = {
          id: result.auditId,
          actionType: body.actionType,
          createdAt: result.createdAt.toISOString(),
        };
        return reply.status(200).send(response);
      }

      if (body.actionType === 'region_rollback') {
        const region = parseRegion(body.targetRef);
        if (!region) return err(reply, request, 422, 'VALIDATION_ERROR', 'targetRef must be "x1,y1,x2,y2" with x1≤x2, y1≤y2.');
        const area = (region.x2 - region.x1 + 1) * (region.y2 - region.y1 + 1);
        if (area > MAX_REGION_CELLS) return err(reply, request, 422, 'VALIDATION_ERROR', `Region too large (max ${MAX_REGION_CELLS} cells).`);
        const canvas = await repo.findViewableCanvas(request.tenant.id);
        if (!canvas) return err(reply, request, 404, 'NOT_FOUND', 'No canvas for this tenant.');
        if (canvas.status === 'archived') return err(reply, request, 409, 'CONFLICT', 'Cannot modify an archived canvas.');
        if (region.x2 >= canvas.width || region.y2 >= canvas.height) {
          return err(reply, request, 422, 'VALIDATION_ERROR', 'Region is out of canvas bounds.');
        }
        const result = await repo.rollbackRegion({
          tenantId: request.tenant.id,
          canvasId: canvas.id,
          actorUserId: principal.userId,
          x1: region.x1,
          y1: region.y1,
          x2: region.x2,
          y2: region.y2,
          reason: body.reason,
        });
        if (result.kind === 'archived') return err(reply, request, 409, 'CONFLICT', 'Cannot modify an archived canvas.');
        const message: ws.RegionRolledBack = { type: 'RegionRolledBack', region };
        try {
          await bus.publish(request.tenant.id, canvas.id, message);
        } catch {
          // best-effort broadcast
        }
        const response: dto.ModerationActionResponse = {
          id: result.auditId,
          actionType: body.actionType,
          createdAt: result.createdAt.toISOString(),
        };
        return reply.status(200).send(response);
      }

      return err(reply, request, 422, 'VALIDATION_ERROR', 'Unsupported action type.');
    });
  };
}
