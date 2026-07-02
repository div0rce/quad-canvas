// apps/web — friends client: fetch the graph + drive the request lifecycle. DC2 only (handles,
// never emails). Mutations carry an Idempotency-Key; the server's relationship check makes repeated
// clicks safe regardless.
import type { dto } from '@quad/core';
import { apiPath } from '@/lib/api-base';

const RELATIONSHIPS: readonly dto.FriendRelationship[] = ['self', 'none', 'outgoing', 'incoming', 'friends'];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function isMember(v: unknown): v is dto.FriendMember {
  return isRecord(v) && typeof v['handle'] === 'string' && typeof v['role'] === 'string';
}

function isRelationship(v: unknown): v is dto.FriendRelationship {
  return typeof v === 'string' && (RELATIONSHIPS as readonly string[]).includes(v);
}

export function isFriendsResponse(v: unknown): v is dto.FriendsResponse {
  return (
    isRecord(v) &&
    Array.isArray(v['friends']) &&
    Array.isArray(v['incoming']) &&
    Array.isArray(v['outgoing']) &&
    v['friends'].every(isMember) &&
    v['incoming'].every(isMember) &&
    v['outgoing'].every(isMember)
  );
}

function isSearchResult(v: unknown): v is dto.FriendSearchResult {
  return isRecord(v) && typeof v['handle'] === 'string' && typeof v['role'] === 'string' && isRelationship(v['relationship']);
}

export function isFriendSearchResponse(v: unknown): v is dto.FriendSearchResponse {
  return isRecord(v) && Array.isArray(v['results']) && v['results'].every(isSearchResult);
}

async function getJson(path: string): Promise<unknown> {
  try {
    const res = await fetch(apiPath(path), { credentials: 'include' });
    return res.ok ? ((await res.json()) as unknown) : null;
  } catch {
    return null;
  }
}

/** Read the caller's friends + pending requests, or null on failure. */
export async function fetchFriends(): Promise<dto.FriendsResponse | null> {
  const body = await getJson('/api/v1/friends');
  return isFriendsResponse(body) ? body : null;
}

function isActivityItem(v: unknown): v is dto.FriendActivityItem {
  return isRecord(v) && typeof v['handle'] === 'string' && isRecord(v['at']) && typeof v['placedAt'] === 'string';
}

/** Recent placements by the caller's confirmed friends (newest first), or [] on failure. */
export async function fetchFriendActivity(): Promise<readonly dto.FriendActivityItem[]> {
  const body = await getJson('/api/v1/friends/activity');
  const items = isRecord(body) ? body['items'] : undefined;
  return Array.isArray(items) && items.every(isActivityItem) ? items : [];
}

/** The caller's relationship to a member by handle, or null when signed out / unknown member. */
export async function fetchRelationship(handle: string): Promise<dto.FriendRelationship | null> {
  const body = await getJson(`/api/v1/friends/relationship/${encodeURIComponent(handle.replace(/^@/, ''))}`);
  const rel = isRecord(body) ? body['relationship'] : undefined;
  return isRelationship(rel) ? rel : null;
}

/** Search active members by public handle (prefix), with the caller's relationship to each. */
export async function searchFriends(query: string): Promise<readonly dto.FriendSearchResult[]> {
  if (query.trim() === '') return [];
  const body = await getJson(`/api/v1/friends/search?q=${encodeURIComponent(query.trim())}`);
  return isFriendSearchResponse(body) ? body.results : [];
}

async function post(path: string, body: unknown, idempotent: boolean): Promise<dto.FriendRelationship | null> {
  try {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (idempotent) headers['idempotency-key'] = crypto.randomUUID();
    const res = await fetch(apiPath(path), { method: 'POST', credentials: 'include', headers, body: JSON.stringify(body) });
    if (!res.ok) return null;
    const json = (await res.json()) as unknown;
    const rel = isRecord(json) ? json['relationship'] : undefined;
    return isRelationship(rel) ? rel : null;
  } catch {
    return null;
  }
}

/** Send a friend request by handle → returns the new relationship ('outgoing' or 'friends'). */
export function sendFriendRequest(handle: string): Promise<dto.FriendRelationship | null> {
  return post('/api/v1/friends/requests', { handle }, true);
}

/** Accept an incoming request from `handle`. */
export function acceptFriendRequest(handle: string): Promise<dto.FriendRelationship | null> {
  return post('/api/v1/friends/requests/accept', { handle }, false);
}

/** Cancel an outgoing request to `handle`. */
export function cancelFriendRequest(handle: string): Promise<dto.FriendRelationship | null> {
  return post('/api/v1/friends/requests/cancel', { handle }, false);
}

/** Remove a confirmed friend by handle. */
export async function removeFriend(handle: string): Promise<dto.FriendRelationship | null> {
  try {
    const res = await fetch(apiPath(`/api/v1/friends/${encodeURIComponent(handle.replace(/^@/, ''))}`), {
      method: 'DELETE',
      credentials: 'include',
    });
    return res.ok ? 'none' : null;
  } catch {
    return null;
  }
}

/** The Add-friends button label for a relationship. */
export function addButtonLabel(relationship: dto.FriendRelationship): string {
  switch (relationship) {
    case 'friends':
      return 'Friends';
    case 'outgoing':
      return 'Requested';
    case 'incoming':
      return 'Accept';
    default:
      return 'Add';
  }
}
