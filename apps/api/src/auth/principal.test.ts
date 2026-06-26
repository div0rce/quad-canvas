import { describe, it, expect } from 'vitest';
import { InMemorySessionStore } from './session-store.js';
import { resolvePrincipal, type MembershipLookup } from './principal.js';

const activeMember: MembershipLookup = { findActiveMembership: () => Promise.resolve({ role: 'participant' }) };
const noMember: MembershipLookup = { findActiveMembership: () => Promise.resolve(null) };

describe('resolvePrincipal', () => {
  it('resolves a principal for a valid session + active membership', async () => {
    const store = new InMemorySessionStore();
    const id = await store.create({ userId: 'u1', tenantId: 't1' }, 3600);
    const principal = await resolvePrincipal(store, activeMember, id, 't1');
    expect(principal).toEqual({ userId: 'u1', tenantId: 't1', role: 'participant' });
  });

  it('returns null with no session id', async () => {
    const store = new InMemorySessionStore();
    expect(await resolvePrincipal(store, activeMember, undefined, 't1')).toBeNull();
    expect(await resolvePrincipal(store, activeMember, '', 't1')).toBeNull();
  });

  it('returns null for an unknown session', async () => {
    const store = new InMemorySessionStore();
    expect(await resolvePrincipal(store, activeMember, 'nope', 't1')).toBeNull();
  });

  it('returns null when the session is for a different tenant', async () => {
    const store = new InMemorySessionStore();
    const id = await store.create({ userId: 'u1', tenantId: 't1' }, 3600);
    expect(await resolvePrincipal(store, activeMember, id, 't2')).toBeNull();
  });

  it('returns null when there is no active membership (banned/suspended)', async () => {
    const store = new InMemorySessionStore();
    const id = await store.create({ userId: 'u1', tenantId: 't1' }, 3600);
    expect(await resolvePrincipal(store, noMember, id, 't1')).toBeNull();
  });
});
