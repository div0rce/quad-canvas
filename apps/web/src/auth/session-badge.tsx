'use client';

// apps/web — session badge. Reflects the current identity from GET /session (DC2 handle/role) and
// offers sign-in / sign-out. The server stays authoritative — this is display + a convenience link.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchSession, signOut, type SessionInfo } from './auth-client';

export function SessionBadge(): React.ReactElement | null {
  const [session, setSession] = useState<SessionInfo | null>(null);

  useEffect(() => {
    let active = true;
    void fetchSession().then((s) => {
      if (active) setSession(s);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!session) return null; // still loading
  if (!session.authenticated) {
    return <Link href="/signin">Sign in</Link>;
  }
  return (
    <span>
      Signed in{session.handle ? ` as ${session.handle}` : ''}
      {session.role ? ` (${session.role})` : ''}{' '}
      <button
        type="button"
        onClick={() => {
          // Reload regardless of outcome (re-reads /session) and never leak an unhandled rejection on
          // a network failure — `.then` alone would skip the reload and reject unhandled.
          void signOut()
            .catch(() => undefined)
            .finally(() => window.location.reload());
        }}
      >
        Sign out
      </button>
    </span>
  );
}
