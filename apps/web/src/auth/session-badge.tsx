'use client';

// apps/web — session badge. Reflects the current identity from GET /session (DC2 handle/role) and
// offers sign-in / sign-out. The server stays authoritative — this is display + a convenience link.
import { useEffect, useState } from 'react';
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
    return <a href="/signin">Sign in</a>;
  }
  return (
    <span>
      Signed in{session.handle ? ` as ${session.handle}` : ''}
      {session.role ? ` (${session.role})` : ''}{' '}
      <button
        type="button"
        onClick={() => {
          void signOut().then(() => window.location.reload());
        }}
      >
        Sign out
      </button>
    </span>
  );
}
