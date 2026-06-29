'use client';

// apps/web — sign-in confirm landing. The magic link points here with `?token=…`; on load we POST it
// to the front-door, which (on success) sets the httpOnly session cookie. The token is read from the
// URL only — it's never stored in app state — and used once. Reads the token in an effect (client-
// only) to avoid the useSearchParams Suspense requirement.
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { confirmMessage, confirmToken, retainSignInToken } from '@/auth/auth-client';

export default function ConfirmPage(): React.ReactElement {
  const [status, setStatus] = useState('Confirming your sign-in…');
  const [done, setDone] = useState(false);
  const tokenRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const firstSetup = tokenRef.current === undefined;
    const token = retainSignInToken(tokenRef.current, window.location.search);
    tokenRef.current = token;
    // Scrub only on the first setup. The ref preserves the token when React Strict Mode replays this
    // effect after cleanup, so the replay neither loses the token nor posts it twice.
    if (firstSetup && window.location.search) {
      window.history.replaceState({}, '', window.location.pathname);
    }
    let cancelled = false;
    void (async () => {
      // Defer URL-derived state updates out of the effect body. This avoids a redundant synchronous
      // render while preserving the client-only token read and immediate address-bar scrub.
      await Promise.resolve();
      if (cancelled) return;
      if (!token) {
        setStatus('No sign-in token in this link.');
        setDone(true);
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
