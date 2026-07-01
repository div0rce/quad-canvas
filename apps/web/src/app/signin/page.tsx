'use client';

// apps/web — sign-in (magic-link request). Enter a university email → the server emails a sign-in
// link (eligibility is the server's call via the tenant domain allowlist; this only shape-checks).
import { useState } from 'react';
import { isLikelyEmail, requestMessage, requestVerification } from '@/auth/auth-client';
import { AppBar } from '@/components/ui/app-bar';
import { useTenant } from '@/components/tenant-provider';

export default function SignInPage(): React.ReactElement {
  const tenant = useTenant();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(false);
  // The check-inbox view is gated on explicit state set only by a real 202 — so a Resend that
  // fails (e.g. a 429 rate-limit) keeps the user on the check-inbox screen instead of ejecting
  // them back to the form mid-request.
  const [sent, setSent] = useState(false);

  async function submit(event?: React.FormEvent): Promise<void> {
    event?.preventDefault();
    if (!isLikelyEmail(email)) {
      setStatus('Enter a valid email address.');
      return;
    }
    setBusy(true);
    setStatus('Sending…');
    try {
      const code = await requestVerification(email.trim());
      setStatus(requestMessage(code));
      if (code === 202) setSent(true);
    } catch {
      setStatus('Network error — try again.');
    } finally {
      setBusy(false);
    }
  }

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
      <p className="quad-board-label">Sign in</p>
      <div className="quad-panel">
        <AppBar
          tenantLabel={tenant?.title ?? null}
          right={<span className="quad-appbar__tenant">Verified students only</span>}
        />

        <div style={{ padding: '44px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 34 }}>
            <h1 className="quad-pixel" style={{ fontSize: 24, color: 'var(--ink)', margin: 0 }}>
              Paint the canvas
            </h1>
            <p style={{ fontSize: 21, color: 'var(--ink-strong)', margin: '14px 0 0' }}>
              One account per real student. No passwords. We email you a sign-in link.
            </p>
          </div>

          <div
            className="quad-card quad-card--card"
            style={{ width: '100%', maxWidth: 460, margin: '0 auto', padding: 28 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 22 }}>
              <span style={badgeStyle(sent ? 'var(--ink)' : 'var(--qa)')}>{sent ? '2' : '1'}</span>
              <span className="quad-pixel" style={{ fontSize: 14, color: 'var(--ink)' }}>
                {sent ? 'Check inbox' : 'Your email'}
              </span>
            </div>

            {!sent ? (
              <form onSubmit={(e) => void submit(e)}>
                <label
                  htmlFor="email"
                  style={{
                    display: 'block',
                    fontSize: 16,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: 'var(--muted-label)',
                  }}
                >
                  University email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  required
                  autoComplete="email"
                  placeholder="name@university.edu"
                  style={{
                    display: 'block',
                    width: '100%',
                    marginTop: 9,
                    padding: '13px 14px',
                    background: 'var(--surface)',
                    border: '2px solid var(--ink)',
                    boxShadow: focused ? 'inset 0 0 0 2px var(--qa)' : 'inset 0 0 0 2px var(--qa-tint2)',
                    outline: focused ? '2px solid var(--qa)' : 'none',
                    outlineOffset: 2,
                    font: 'inherit',
                    fontSize: 20,
                    color: 'var(--ink)',
                  }}
                />
                <button
                  type="submit"
                  className="quad-btn quad-btn--primary quad-btn--lg"
                  disabled={busy}
                  style={{ width: '100%', marginTop: 16 }}
                >
                  {busy ? 'Sending…' : 'Email me a link'}
                </button>
              </form>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                {/* Envelope mark (decorative). */}
                <div
                  aria-hidden="true"
                  style={{
                    width: 64,
                    height: 46,
                    border: '3px solid var(--qa)',
                    background: 'var(--qa-tint2)',
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: -3,
                      left: -3,
                      right: -3,
                      height: 26,
                      borderBottom: '3px solid var(--qa)',
                      clipPath: 'polygon(0 0, 50% 100%, 100% 0)',
                      background: 'var(--qa-tint)',
                    }}
                  />
                </div>
                <p style={{ fontSize: 21, color: 'var(--ink)', margin: '18px 0 0' }}>
                  Link sent to <span style={{ color: 'var(--qa-strong)' }}>{email}</span>
                </p>
                <p style={{ fontSize: 18, color: 'var(--muted-tag)', margin: '6px 0 0', maxWidth: '36ch' }}>
                  Open it on any device to finish — the link expires soon.
                </p>
                <span className="quad-pill quad-pill--paper" style={{ marginTop: 16 }}>
                  <span className="quad-dot quad-blink" style={{ background: 'var(--status-orange)' }} />
                  <span style={{ textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    Waiting for verification
                  </span>
                </span>
                <p style={{ fontSize: 18, color: 'var(--muted-tag)', margin: '14px 0 0' }}>
                  No link?{' '}
                  <button
                    type="button"
                    onClick={() => void submit()}
                    disabled={busy}
                    style={{
                      background: 'none',
                      border: 0,
                      padding: 0,
                      font: 'inherit',
                      color: 'var(--qa)',
                      cursor: busy ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {busy ? 'Sending…' : 'Resend'}
                  </button>
                  {' · '}
                  <button
                    type="button"
                    onClick={() => {
                      setSent(false);
                      setStatus('');
                    }}
                    style={{
                      background: 'none',
                      border: 0,
                      padding: 0,
                      font: 'inherit',
                      color: 'var(--muted-tag)',
                      cursor: 'pointer',
                    }}
                  >
                    Use a different email
                  </button>
                </p>
              </div>
            )}

            <p
              role="status"
              aria-live="polite"
              style={{
                minHeight: '1.2em',
                margin: '16px 0 0',
                fontSize: 18,
                color: 'var(--muted-tag)',
                textAlign: sent ? 'center' : 'left',
              }}
            >
              {status}
            </p>
          </div>

          <p style={{ textAlign: 'center', margin: '28px auto 0', maxWidth: 460, fontSize: 18, color: 'var(--muted-tag)' }}>
            We only ever show your <span style={{ color: 'var(--ink-soft)' }}>public handle</span>. Your email is
            never shown to anyone.
          </p>
        </div>
      </div>
    </main>
  );
}
