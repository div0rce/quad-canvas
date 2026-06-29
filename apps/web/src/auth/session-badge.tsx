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
    return (
      <a className="quad-btn quad-btn--primary" href="/signin">
        Sign in
      </a>
    );
  }
  const atHandle = session.handle ? (session.handle.startsWith('@') ? session.handle : `@${session.handle}`) : '';
  const initial = (atHandle.replace(/^@/, '')[0] ?? '?').toUpperCase();
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <span className="quad-chip" title={session.role ? `Signed in (${session.role})` : 'Signed in'}>
        <span>{atHandle || 'Signed in'}</span>
        <span className="quad-avatar" style={{ width: 26, height: 26, fontSize: 11 }}>
          {initial}
        </span>
      </span>
      <button
        type="button"
        onClick={() => {
          // Reload regardless of outcome (re-reads /session) and never leak an unhandled rejection on
          // a network failure — `.then` alone would skip the reload and reject unhandled.
          void signOut()
            .catch(() => undefined)
            .finally(() => window.location.reload());
        }}
        style={{
          background: 'none',
          border: 0,
          padding: 0,
          font: 'inherit',
          fontSize: 16,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: 'var(--muted-tag)',
          cursor: 'pointer',
        }}
      >
        Sign out
      </button>
    </span>
  );
}
