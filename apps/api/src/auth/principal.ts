// apps/api — resolve a request's verified Principal from its session. Fail-closed at every step:
// no session id, an unknown/expired session, a session for a different tenant, or no ACTIVE
// membership all yield null (→ the route rejects writes with 401). The session proves identity;
// the active Membership proves current authorization (a ban/suspension drops the membership, so a
// still-valid session no longer resolves a principal — defense alongside session revocation).
import type { domain } from '@quad/core';
import type { SessionStore } from './session-store.js';

export interface ActiveMembership {
  readonly role: domain.Role;
}

export interface MembershipLookup {
  /** The user's ACTIVE membership in the tenant, or null (suspended/banned/none). */
  findActiveMembership(tenantId: string, userId: string): Promise<ActiveMembership | null>;
}

export async function resolvePrincipal(
  store: SessionStore,
  memberships: MembershipLookup,
  sessionId: string | undefined,
  tenantId: string,
): Promise<domain.Principal | null> {
  if (sessionId === undefined || sessionId === '') return null;
  const session = await store.get(sessionId);
  if (!session) return null;
  if (session.tenantId !== tenantId) return null; // a session is bound to one tenant
  const membership = await memberships.findActiveMembership(tenantId, session.userId);
  if (!membership) return null; // no current authorization
  return {
    userId: session.userId as domain.UserId,
    tenantId: tenantId as domain.TenantId,
    role: membership.role,
  };
}
