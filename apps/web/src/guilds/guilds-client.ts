// apps/web — guilds client: directory + profile reads and the membership actions. DC2 only. Guilds
// are social/identity grouping; they confer no placement advantage.
import type { dto } from '@quad/core';
import { apiPath } from '@/lib/api-base';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function isSummary(v: unknown): v is dto.GuildSummary {
  return (
    isRecord(v) &&
    typeof v['slug'] === 'string' &&
    typeof v['name'] === 'string' &&
    typeof v['memberCount'] === 'number' &&
    typeof v['joined'] === 'boolean' &&
    typeof v['active'] === 'boolean'
  );
}

export function isGuildsResponse(v: unknown): v is dto.GuildsResponse {
  return isRecord(v) && Array.isArray(v['guilds']) && v['guilds'].every(isSummary);
}

export function isGuildDetail(v: unknown): v is dto.GuildDetailResponse {
  return isSummary(v) && Array.isArray((v as { members?: unknown }).members);
}

async function getJson(path: string): Promise<unknown> {
  try {
    const res = await fetch(apiPath(path), { credentials: 'include' });
    return res.ok ? ((await res.json()) as unknown) : null;
  } catch {
    return null;
  }
}

/** The tenant's guild directory with the caller's membership flags. */
export async function fetchGuilds(): Promise<readonly dto.GuildSummary[]> {
  const body = await getJson('/api/v1/guilds');
  return isGuildsResponse(body) ? body.guilds : [];
}

/** One guild's profile (members + the caller's relationship), or null. */
export async function fetchGuild(slug: string): Promise<dto.GuildDetailResponse | null> {
  const body = await getJson(`/api/v1/guilds/${encodeURIComponent(slug)}`);
  return isGuildDetail(body) ? body : null;
}

export interface CreateGuildOutcome {
  readonly ok: boolean;
  readonly slug?: string;
  readonly error?: string;
}

/** Create a guild. On success returns the derived slug. */
export async function createGuild(name: string, description: string): Promise<CreateGuildOutcome> {
  try {
    const res = await fetch(apiPath('/api/v1/guilds'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, ...(description.trim() !== '' ? { description } : {}) }),
    });
    if (res.status === 201) {
      const json = (await res.json()) as unknown;
      const slug = isRecord(json) && typeof json['slug'] === 'string' ? json['slug'] : undefined;
      return slug !== undefined ? { ok: true, slug } : { ok: true };
    }
    if (res.status === 409) return { ok: false, error: 'A guild with that name already exists.' };
    if (res.status === 422) return { ok: false, error: 'Enter a name with letters or numbers.' };
    return { ok: false, error: 'Could not create the guild.' };
  } catch {
    return { ok: false, error: 'Could not create the guild.' };
  }
}

async function action(path: string): Promise<boolean> {
  try {
    const res = await fetch(apiPath(path), { method: 'POST', credentials: 'include' });
    return res.ok;
  } catch {
    return false;
  }
}

export function joinGuild(slug: string): Promise<boolean> {
  return action(`/api/v1/guilds/${encodeURIComponent(slug)}/join`);
}
export function leaveGuild(slug: string): Promise<boolean> {
  return action(`/api/v1/guilds/${encodeURIComponent(slug)}/leave`);
}
export function setActiveGuild(slug: string): Promise<boolean> {
  return action(`/api/v1/guilds/${encodeURIComponent(slug)}/active`);
}

/** The membership button label for a guild given the caller's relationship. */
export function guildActionLabel(guild: Pick<dto.GuildSummary, 'joined' | 'active'>): string {
  if (guild.active) return 'Active';
  if (guild.joined) return 'Set active';
  return 'Join';
}
