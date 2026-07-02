// apps/web — onboarding client: self-edit the caller's profile (handle + display name) during the
// first-run flow. DC2 only.
import { apiPath } from '@/lib/api-base';

const HANDLE_RE = /^[a-zA-Z0-9_-]{3,24}$/;

/** Client-side handle check (the server is authoritative on uniqueness). Null = looks valid. */
export function handleValidationError(handle: string): string | null {
  const h = handle.trim().replace(/^@/, '');
  if (h === '') return 'Pick a username.';
  if (!HANDLE_RE.test(h)) return '3–24 characters: letters, numbers, underscores, or hyphens.';
  return null;
}

export interface UpdateProfileOutcome {
  readonly ok: boolean;
  readonly handle?: string | null;
  readonly error?: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** Set the caller's handle and/or display name. */
export async function updateProfile(fields: { handle?: string; displayName?: string }): Promise<UpdateProfileOutcome> {
  try {
    const res = await fetch(apiPath('/api/v1/profiles/me'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(fields),
    });
    if (res.ok) {
      const json = (await res.json()) as unknown;
      const handle = isRecord(json) && (typeof json['handle'] === 'string' || json['handle'] === null) ? json['handle'] : null;
      return { ok: true, handle };
    }
    if (res.status === 409) return { ok: false, error: 'That username is taken — try another.' };
    if (res.status === 422) return { ok: false, error: 'That username isn’t valid.' };
    return { ok: false, error: 'Could not save. Try again.' };
  } catch {
    return { ok: false, error: 'Could not save. Try again.' };
  }
}
