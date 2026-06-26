// apps/api — moderation actions (moderator+). Reversible, role-scoped, and AUDITED: the status
// change + the append-only moderation_actions record commit ATOMICALLY (no action without an audit,
// P-MOD-4); there is no hard delete (MODERATION.md / API.md §19). Destructive actions need a higher
// role (ban → admin), a moderator can only act on members of a LOWER role, and a reason is required.
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { domain, dto } from '@quad/core';
import type { PlacementRepository } from '@quad/db';
import type { SessionStore } from '../auth/session-store.js';
import { requireRole, hasMinRole } from '../auth/roles.js';

const MEMBER_ACTIONS: Record<string, { status: 'suspended' | 'banned' | 'active'; minRole: domain.Role }> = {
  suspend_member: { status: 'suspended', minRole: 'moderator' },
  ban_member: { status: 'banned', minRole: 'admin' },
  reinstate_member: { status: 'active', minRole: 'moderator' },
};

// Report-queue actions (moderator-level): `targetRef` is the report id.
const REPORT_ACTIONS: Record<string, 'resolved' | 'dismissed'> = {
  resolve_report: 'resolved',
  dismiss_report: 'dismissed',
};

function err(reply: FastifyReply, request: FastifyRequest, status: number, code: dto.ErrorCode, message: string): FastifyReply {
  const body: dto.ErrorResponse = { error: { code, message, requestId: request.id } };
  return reply.status(status).send(body);
}

export function makeModerationRoutes(repo: PlacementRepository, sessions: SessionStore): FastifyPluginAsync {
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
        });
        if (!result.updated) return err(reply, request, 404, 'NOT_FOUND', 'Report not found in this tenant.');
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
