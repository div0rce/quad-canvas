// apps/api — role hierarchy + authorization guard. Roles are tenant-scoped (participant < moderator
// < admin); operator is platform-level (cross-tenant). Authorization is enforced server-side per
// endpoint (`API.md` catalog) — UI gating is never the control (FE-INV-10 / BE-INV-6). Endpoints
// requiring more than a verified participant attach `requireRole(min)` as a preHandler.
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { domain, dto } from '@quad/core';

/** All known roles, low → high. The single source for both parsing (`toRole`) and ordering (`RANK`). */
export const ROLES: readonly domain.Role[] = ['participant', 'moderator', 'admin', 'operator'];

// Rank map derived from ROLES order so parsing and ordering can never drift apart.
const RANK = Object.fromEntries(ROLES.map((role, i) => [role, i + 1])) as Record<domain.Role, number>;

/** Narrow an arbitrary string to a known `Role`, or `null` for an unrecognized value (deny / fail closed). */
export function toRole(role: string): domain.Role | null {
  return (ROLES as readonly string[]).includes(role) ? (role as domain.Role) : null;
}

/** True if `role` meets or exceeds `min` in the hierarchy. */
export function hasMinRole(role: domain.Role, min: domain.Role): boolean {
  return RANK[role] >= RANK[min];
}

/**
 * A Fastify preHandler that requires an authenticated principal with at least `min` role. Replies
 * 401 (no principal) or 403 (insufficient role) and halts the route; otherwise passes through.
 */
export function requireRole(min: domain.Role) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const principal = request.principal;
    if (!principal) {
      const body: dto.ErrorResponse = { error: { code: 'UNAUTHENTICATED', message: 'Authentication required.', requestId: request.id } };
      await reply.status(401).send(body);
      return;
    }
    if (!hasMinRole(principal.role, min)) {
      const body: dto.ErrorResponse = { error: { code: 'FORBIDDEN', message: 'Insufficient role for this action.', requestId: request.id } };
      await reply.status(403).send(body);
      return;
    }
  };
}
