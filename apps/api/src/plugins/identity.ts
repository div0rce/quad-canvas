// apps/api — request principal (INTERIM). There is no production identity source yet: the
// session mechanism that turns a request into a verified Principal (validated membership) is
// owned by AUTHENTICATION.md / ADR-0006 and lands with the auth milestone. Until then
// `request.principal` is always null and write routes reject (401) — NO anonymous writes
// (PRIN-NO-ANON) and NO header-trust bypass. The placement domain service already takes the
// Principal as input, so only this resolution step changes when auth lands.
import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

const identityPlugin: FastifyPluginAsync = async (app) => {
  app.decorateRequest('principal', null);
};

export default fp(identityPlugin, { name: 'identity' });
