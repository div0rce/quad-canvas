// apps/web — auth client. Thin fetch wrappers over the magic-link front-door + pure message mappers
// (unit-tested in the node env). The token never appears in the UI's own state beyond the confirm
// call; the session is an httpOnly cookie the browser carries automatically (credentials: include).
import { isSessionResponse } from '@/lib/api-response';
import { apiPath } from '@/lib/api-base';

/** Loose shape check — the server is the authority on eligibility (domain allowlist). */
export function isLikelyEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** Keep the first URL token across React Strict Mode's development effect setup/cleanup replay. */
export function retainSignInToken(captured: string | null | undefined, search: string): string | null {
  return captured === undefined ? new URLSearchParams(search).get('token') : captured;
}

/** Map a verify-request response to a user message. */
export function requestMessage(status: number): string {
  switch (status) {
    case 202:
      return 'Check your email for a sign-in link.';
    case 422:
      return 'Enter a valid email address.';
    case 403:
      return "This email isn't eligible to join this canvas.";
    case 429:
      return 'Too many requests — try again shortly.';
    default:
      return 'Could not send the sign-in link. Try again.';
  }
}

/** Map a verify-confirm response to a user message. */
export function confirmMessage(status: number): string {
  switch (status) {
    case 200:
      return 'Signed in. You can now place pixels.';
    case 409:
      return 'That sign-in link is invalid, expired, or already used.';
    case 422:
      return 'Missing or invalid sign-in token.';
    case 429:
      return 'Too many attempts — try again shortly.';
    default:
      return 'Could not complete sign-in. Try again.';
  }
}

export async function requestVerification(email: string): Promise<number> {
  const res = await fetch(apiPath('/api/v1/auth/verify/request'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email }),
  });
  return res.status;
}

export async function confirmToken(token: string): Promise<number> {
  const res = await fetch(apiPath('/api/v1/auth/verify/confirm'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ token }),
  });
  return res.status;
}

export interface SessionInfo {
  readonly authenticated: boolean;
  readonly handle?: string;
  readonly role?: string;
}

export async function fetchSession(): Promise<SessionInfo> {
  try {
    const res = await fetch(apiPath('/api/v1/session'), { credentials: 'include' });
    if (!res.ok) return { authenticated: false };
    const body = (await res.json()) as unknown;
    if (!isSessionResponse(body)) return { authenticated: false };
    return {
      authenticated: body.authenticated,
      ...(body.user?.handle ? { handle: body.user.handle } : {}),
      ...(body.role ? { role: body.role } : {}),
    };
  } catch {
    return { authenticated: false };
  }
}

export async function signOut(): Promise<void> {
  await fetch(apiPath('/api/v1/auth/signout'), { method: 'POST', credentials: 'include' });
}
