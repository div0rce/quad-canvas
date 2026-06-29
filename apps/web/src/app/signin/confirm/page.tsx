'use client';

// apps/web — sign-in confirm landing. The magic link points here with `?token=…`; on load we POST it
// to the front-door, which (on success) sets the httpOnly session cookie. The token is read from the
// URL only — it's never stored in app state — and used once. Reads the token in an effect (client-
// only) to avoid the useSearchParams Suspense requirement.
import { useEffect, useRef, useState } from 'react';
import { confirmMessage, confirmToken, retainSignInToken } from '@/auth/auth-client';
import { AppBar } from '@/components/ui/app-bar';
import { useTenant } from '@/components/tenant-provider';

export default function ConfirmPage(): React.ReactElement {
  const tenant = useTenant();
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

  // Verified iff the response mapped to the 200 message (single source of truth = confirmMessage).
  const ok = status === confirmMessage(200);

  const badgeStyle = (bg: string): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    flex: 'none',
    background: bg,
    color: '#fff',
    fontFamily: 'var(--font-pixel), var(--font-pixel-fallback)',
    fontSize: 13,
  });

  return (
    <main className="quad-page">
      <p className="quad-board-label">Email verification</p>
      <div className="quad-panel">
        <AppBar
          tenantLabel={tenant?.title ?? null}
          right={<span className="quad-appbar__tenant">Verified students only</span>}
        />

        <div style={{ padding: '44px 24px' }}>
          <div
            className="quad-card quad-card--card"
            style={{ width: '100%', maxWidth: 460, margin: '0 auto', padding: 28 }}
          >
            <h1 className="quad-pixel" style={{ fontSize: 20, color: 'var(--ink)', textAlign: 'center', margin: '0 0 24px' }}>
              Verify your sign-in
            </h1>
            {/* Step trail: email (done, ink) → verify (active, accent). */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 26 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={badgeStyle('var(--ink)')}>1</span>
                <span className="quad-pixel" style={{ fontSize: 13, color: 'var(--muted-tag)' }}>
                  Email
                </span>
              </span>
              <span aria-hidden="true" style={{ color: 'var(--muted-faint)' }}>
                →
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={badgeStyle('var(--qa)')}>2</span>
                <span className="quad-pixel" style={{ fontSize: 13, color: 'var(--ink)' }}>
                  Verify
                </span>
              </span>
            </div>

            {ok ? (
              // Verified — green success banner.
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 13,
                  padding: 15,
                  border: '2px solid var(--ink)',
                  background: 'color-mix(in srgb, var(--live-green) 8%, #fff)',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{ position: 'relative', width: 34, height: 34, flex: 'none', background: 'var(--live-green)' }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      left: 12,
                      top: 7,
                      width: 7,
                      height: 15,
                      borderRight: '3px solid #fff',
                      borderBottom: '3px solid #fff',
                      transform: 'rotate(40deg)',
                    }}
                  />
                </span>
                <div>
                  <div style={{ fontSize: 21, color: 'var(--ink)' }}>Verified</div>
                  <div style={{ fontSize: 16, color: 'var(--ink-strong)', marginTop: 1 }}>
                    You can place your first pixel now.
                  </div>
                </div>
              </div>
            ) : (
              // Verifying (or failed) — waiting/notice state.
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <span className="quad-pill quad-pill--paper">
                  <span
                    className="quad-dot quad-blink"
                    style={{ background: done ? 'var(--status-orange)' : 'var(--status-blue)' }}
                  />
                  <span style={{ textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    {done ? 'Action needed' : 'Verifying'}
                  </span>
                </span>
              </div>
            )}

            <p
              role="status"
              aria-live="polite"
              style={{ margin: '16px 0 0', fontSize: 18, color: 'var(--ink-strong)', textAlign: 'center' }}
            >
              {status}
            </p>

            {done && (
              <a
                href="/canvas"
                className={ok ? 'quad-btn quad-btn--primary quad-btn--lg' : 'quad-btn quad-btn--lg'}
                style={{ width: '100%', marginTop: 16 }}
              >
                Go to the canvas →
              </a>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
