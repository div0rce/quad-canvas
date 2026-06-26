// apps/api — request principal. Resolves the verified Principal from the session cookie on every
// request (BE-INV-6 / PRIN-NO-ANON): the opaque cookie id is validated against the server-side
// session store and the user's ACTIVE membership; anything short of that leaves `principal` null, so
// write routes reject with 401 (no anonymous writes, no header-trust bypass). When no resolver is
// wired (no session store configured) `principal` is always null — the pre-auth posture.
import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import type { SessionStore } from '../auth/session-store.js';
import { resolvePrincipal, type MembershipLookup } from '../auth/principal.js';

export const SESSION_COOKIE = 'quad_session';

export interface IdentityResolver {
  readonly store: SessionStore;
  readonly memberships: MembershipLookup;
}

export function makeIdentityPlugin(resolver?: IdentityResolver): FastifyPluginAsync {
  return fp(
    async (app) => {
      app.decorateRequest('principal', null);
      if (!resolver) return; // no auth wired → principal stays null (writes 401)
      app.addHook('onRequest', async (request) => {
        const tenant = request.tenant;
        if (!tenant) {
          request.principal = null;
          return;
        }
        const sessionId = request.cookies?.[SESSION_COOKIE];
        request.principal = await resolvePrincipal(resolver.store, resolver.memberships, sessionId, tenant.id);
      });
    },
    { name: 'identity' },
  );
}
