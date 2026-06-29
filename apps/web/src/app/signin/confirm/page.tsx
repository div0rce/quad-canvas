'use client';

// apps/web — sign-in confirm landing. The magic link points here with `?token=…`; on load we POST it
// to the front-door, which (on success) sets the httpOnly session cookie. The token is read from the
// URL only — it's never stored in app state — and used once. Reads the token in an effect (client-
// only) to avoid the useSearchParams Suspense requirement.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { confirmMessage, confirmToken } from '@/auth/auth-client';

export default function ConfirmPage(): React.ReactElement {
  const [status, setStatus] = useState('Confirming your sign-in…');
  const [done, setDone] = useState(false);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    // Scrub the token from the address bar/history BEFORE using it, so a still-valid token can't leak
    // via the Referer header (on a later same-origin navigation/fetch) or browser/proxy logs.
    if (window.location.search) {
      window.history.replaceState({}, '', window.location.pathname);
    }
    let cancelled = false;
    void (async () => {
      // Defer URL-derived state updates out of the effect body. This avoids a redundant synchronous
      // render while preserving the client-only token read and immediate address-bar scrub.
      await Promise.resolve();
      if (!token) {
        if (!cancelled) {
          setStatus('No sign-in token in this link.');
          setDone(true);
        }
        return;
      }
      try {
        const code = await confirmToken(token);
        if (!cancelled) setStatus(confirmMessage(code));
      } catch {
        if (!cancelled) setStatus('Network error — try again.');
      } finally {
        if (!cancelled) setDone(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main style={{ padding: '1rem', maxWidth: 420 }}>
      <h1>Signing in</h1>
      <p role="status" aria-live="polite">
        {status}
      </p>
      {done && (
        <p>
          <Link href="/canvas">Go to the canvas →</Link>
        </p>
      )}
    </main>
  );
}
