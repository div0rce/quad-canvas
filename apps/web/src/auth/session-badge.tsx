'use client';

// apps/web — session badge. Reflects the current identity from GET /session (DC2 handle/role) and
// offers sign-in / sign-out. The server stays authoritative — this is display + a convenience link.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchSession, signOut, type SessionInfo } from './auth-client';

function normalizedHandle(handle: string | undefined): string {
  return handle?.replace(/^@/, '') ?? '';
}

export function profileHrefForSession(session: SessionInfo): string {
  const handle = normalizedHandle(session.handle);
  return handle ? `/profiles/${encodeURIComponent(handle)}` : '/profiles/me';
}

export function SessionBadgeView({
  session,
  onSignOut,
}: {
  readonly session: SessionInfo;
  readonly onSignOut?: () => void;
}): React.ReactElement {
  if (!session.authenticated) {
    return (
      <a className="quad-btn quad-btn--primary" href="/signin">
        Sign in
      </a>
    );
  }

  const handle = normalizedHandle(session.handle);
  const atHandle = handle ? `@${handle}` : '';
  const initial = (handle[0] ?? '?').toUpperCase();
  return (
    <span className="quad-session-actions">
      <Link className="quad-btn quad-btn--primary" href={profileHrefForSession(session)}>
        Profile
      </Link>
      <span className="quad-chip" title={session.role ? `Signed in (${session.role})` : 'Signed in'}>
        <span>{atHandle || 'Signed in'}</span>
        <span className="quad-avatar" style={{ width: 26, height: 26, fontSize: 11 }}>
          {initial}
        </span>
      </span>
      <button type="button" onClick={onSignOut} className="quad-session-signout">
        Sign out
      </button>
    </span>
  );
}

export function SessionBadge(): React.ReactElement | null {
  const [session, setSession] = useState<SessionInfo | null>(null);

  useEffect(() => {
    let active = true;
    const load = (): void => {
      void fetchSession().then((s) => {
        if (active) setSession(s);
      });
    };
    load();
    window.addEventListener('focus', load);
    window.addEventListener('pageshow', load);
    return () => {
      active = false;
      window.removeEventListener('focus', load);
      window.removeEventListener('pageshow', load);
    };
  }, []);

  if (!session) return null; // still loading
  return (
    <SessionBadgeView
      session={session}
      onSignOut={() => {
        // Reload regardless of outcome (re-reads /session) and never leak an unhandled rejection on
        // a network failure — `.then` alone would skip the reload and reject unhandled.
        void signOut()
          .catch(() => undefined)
          .finally(() => window.location.reload());
      }}
    />
  );
}
