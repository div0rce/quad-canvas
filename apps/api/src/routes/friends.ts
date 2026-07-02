// apps/api — friends. The campus friend graph: list, search by public handle, and the request
// lifecycle (send → the other member confirms → friends). Every route is principal-gated and
// tenant-scoped; every surface is DC2 (handle/displayName/role) and NEVER an email.
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { domain, dto } from '@quad/core';
import type { FriendMemberRow, FriendSearchRow, PlacementRepository } from '@quad/db';
import { requireRole } from '../auth/roles.js';
import { readIdempotencyKey } from './idempotency.js';

const SEARCH_LIMIT = 15;

function err(reply: FastifyReply, request: FastifyRequest, status: number, code: dto.ErrorCode, message: string): FastifyReply {
  const body: dto.ErrorResponse = { error: { code, message, requestId: request.id } };
  return reply.status(status).send(body);
}

function toMember(row: FriendMemberRow): dto.FriendMember {
  return { handle: row.handle, role: row.role as domain.Role, ...(row.displayName !== null ? { displayName: row.displayName } : {}) };
}

function toSearchResult(row: FriendSearchRow): dto.FriendSearchResult {
  return {
    handle: row.handle,
    role: row.role as domain.Role,
    relationship: row.relationship,
    ...(row.displayName !== null ? { displayName: row.displayName } : {}),
  };
}

function relationshipBody(relationship: dto.FriendRelationship): { readonly relationship: dto.FriendRelationship } {
  return { relationship };
}

/** Read a `{ handle }` body, or null when absent/blank. */
function readHandle(request: FastifyRequest): string | null {
  const body = (request.body ?? {}) as { handle?: unknown };
  return typeof body.handle === 'string' && body.handle.trim() !== '' ? body.handle : null;
}

export function makeFriendRoutes(repo: PlacementRepository): FastifyPluginAsync {
  const member = { preHandler: requireRole('participant') };
  return async (app) => {
    app.get('/api/v1/friends', member, async (request, reply) => {
      const principal = request.principal;
      if (!request.tenant || !principal) return err(reply, request, 401, 'UNAUTHENTICATED', 'Authentication required.');
      const view = await repo.listFriends(request.tenant.id, principal.userId);
      const body: dto.FriendsResponse = {
        friends: view.friends.map(toMember),
        incoming: view.incoming.map(toMember),
        outgoing: view.outgoing.map(toMember),
        counts: { friends: view.friends.length, incoming: view.incoming.length, outgoing: view.outgoing.length },
      };
      void reply.header('Cache-Control', 'private, no-store');
      return reply.send(body);
    });

    app.get('/api/v1/friends/search', member, async (request, reply) => {
      const principal = request.principal;
      if (!request.tenant || !principal) return err(reply, request, 401, 'UNAUTHENTICATED', 'Authentication required.');
      const q = (request.query as { q?: unknown }).q;
      void reply.header('Cache-Control', 'private, no-store');
      if (typeof q !== 'string' || q.trim() === '') {
        return reply.send({ results: [] } satisfies dto.FriendSearchResponse);
      }
      const rows = await repo.searchFriendCandidates(request.tenant.id, principal.userId, q, SEARCH_LIMIT);
      return reply.send({ results: rows.map(toSearchResult) } satisfies dto.FriendSearchResponse);
    });

    app.post('/api/v1/friends/requests', member, async (request, reply) => {
      const principal = request.principal;
      if (!request.tenant || !principal) return err(reply, request, 401, 'UNAUTHENTICATED', 'Authentication required.');
      const idem = readIdempotencyKey(request);
      if (!idem.ok) return err(reply, request, 422, 'VALIDATION_ERROR', idem.message);
      const handle = readHandle(request);
      if (handle === null) return err(reply, request, 422, 'VALIDATION_ERROR', 'A public handle is required.');
      const result = await repo.sendFriendRequest({
        tenantId: request.tenant.id,
        requesterUserId: principal.userId,
        targetHandle: handle,
        idempotencyKey: idem.key,
      });
      switch (result.kind) {
        case 'not_found':
          return err(reply, request, 404, 'NOT_FOUND', 'No member with that handle.');
        case 'self':
          return err(reply, request, 422, 'VALIDATION_ERROR', 'You cannot add yourself.');
        case 'requested':
          return reply.status(201).send(relationshipBody('outgoing'));
        case 'accepted':
          return reply.status(200).send(relationshipBody('friends'));
        case 'exists':
          return reply.status(200).send(relationshipBody(result.relationship));
      }
    });

    app.post('/api/v1/friends/requests/accept', member, async (request, reply) => {
      const principal = request.principal;
      if (!request.tenant || !principal) return err(reply, request, 401, 'UNAUTHENTICATED', 'Authentication required.');
      const handle = readHandle(request);
      if (handle === null) return err(reply, request, 422, 'VALIDATION_ERROR', 'A public handle is required.');
      const result = await repo.acceptFriendRequest(request.tenant.id, principal.userId, handle);
      if (result.kind === 'not_found') return err(reply, request, 404, 'NOT_FOUND', 'No pending request from that member.');
      return reply.send(relationshipBody('friends'));
    });

    app.post('/api/v1/friends/requests/cancel', member, async (request, reply) => {
      const principal = request.principal;
      if (!request.tenant || !principal) return err(reply, request, 401, 'UNAUTHENTICATED', 'Authentication required.');
      const handle = readHandle(request);
      if (handle === null) return err(reply, request, 422, 'VALIDATION_ERROR', 'A public handle is required.');
      const result = await repo.cancelFriendRequest(request.tenant.id, principal.userId, handle);
      if (result.kind === 'not_found') return err(reply, request, 404, 'NOT_FOUND', 'No pending request to that member.');
      return reply.send(relationshipBody('none'));
    });

    app.delete('/api/v1/friends/:handle', member, async (request, reply) => {
      const principal = request.principal;
      if (!request.tenant || !principal) return err(reply, request, 401, 'UNAUTHENTICATED', 'Authentication required.');
      const { handle } = request.params as { handle: string };
      const result = await repo.removeFriend(request.tenant.id, principal.userId, handle);
      if (result.kind === 'not_found') return err(reply, request, 404, 'NOT_FOUND', 'Not friends with that member.');
      return reply.send(relationshipBody('none'));
    });
  };
}
