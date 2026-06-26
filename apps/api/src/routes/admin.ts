// apps/api — tenant admin endpoints (admin role). Role assignment is AUDITED (DC4) and **rotates
// the target's sessions** — a privilege change must force re-authentication so a stale session never
// carries the old role (anti-fixation). `operator` is platform-level and is not assignable per tenant.
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { domain, dto } from '@quad/core';
import type { PlacementRepository } from '@quad/db';
import type { SessionStore } from '../auth/session-store.js';
import { requireRole } from '../auth/roles.js';

const ASSIGNABLE_ROLES = new Set<domain.Role>(['participant', 'moderator', 'admin']);
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

export function makeAdminRoutes(repo: PlacementRepository, sessions: SessionStore): FastifyPluginAsync {
  return async (app) => {
    app.post('/api/v1/admin/roster/roles', { preHandler: requireRole('admin') }, async (request, reply) => {
      const principal = request.principal;
      if (!request.tenant || !principal) return err(reply, request, 401, 'UNAUTHENTICATED', 'Authentication required.');

      const body = (request.body ?? {}) as Partial<dto.AssignRoleCommand>;
      if (typeof body.targetRef !== 'string' || typeof body.role !== 'string') {
        return err(reply, request, 422, 'VALIDATION_ERROR', 'targetRef and role are required.');
      }
      const role = body.role;
      if (!ASSIGNABLE_ROLES.has(role)) {
        return err(reply, request, 422, 'VALIDATION_ERROR', 'role must be participant, moderator, or admin.');
      }

      const currentRole = await repo.getMembershipRole(request.tenant.id, body.targetRef);
      if (currentRole === null) return err(reply, request, 422, 'VALIDATION_ERROR', 'Target is not a member of this tenant.');

      // No-op: same role → no rotation, no audit, just reflect the current state.
      if (currentRole === role) {
        const unchanged: dto.RoleAssignmentResponse = { targetRef: body.targetRef, role };
        return reply.status(200).send(unchanged);
      }

      // Privilege change. Rotate the target's sessions FIRST: if revocation fails the request aborts
      // (500) BEFORE the role is changed, so a stale session can never outlive a committed role change.
      await sessions.revokeAllForUser(body.targetRef);
      const result = await repo.assignMembershipRole({
        tenantId: request.tenant.id,
        actorUserId: principal.userId,
        targetUserId: body.targetRef,
        role,
      });
      if (!result.updated) return err(reply, request, 422, 'VALIDATION_ERROR', 'Target is not a member of this tenant.');

      const response: dto.RoleAssignmentResponse = { targetRef: body.targetRef, role };
      return reply.status(200).send(response);
    });

    app.get('/api/v1/admin/roster', { preHandler: requireRole('admin') }, async (request, reply) => {
      if (!request.tenant) return err(reply, request, 404, 'NOT_FOUND', 'No tenant for this host.');
      const query = request.query as { cursor?: string; limit?: string };
      const limit = clampLimit(query.limit);
      const page = await repo.listRoster(request.tenant.id, {
        limit,
        ...(typeof query.cursor === 'string' ? { cursor: query.cursor } : {}),
      });
      const response: dto.RosterResponse = {
        data: page.items.map((m) => ({
          userId: m.userId,
          role: m.role as domain.Role,
          status: m.status,
          ...(m.handle !== null ? { handle: m.handle } : {}),
          ...(m.displayName !== null ? { displayName: m.displayName } : {}),
        })),
        page: { nextCursor: page.nextCursor, limit },
      };
      return reply.send(response);
    });
  };
}
