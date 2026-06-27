'use client';

// apps/web — sign-in (magic-link request). Enter a university email → the server emails a sign-in
// link (eligibility is the server's call via the tenant domain allowlist; this only shape-checks).
import { useState } from 'react';
import { isLikelyEmail, requestMessage, requestVerification } from '@/auth/auth-client';

export default function SignInPage(): React.ReactElement {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!isLikelyEmail(email)) {
      setStatus('Enter a valid email address.');
      return;
    }
    setBusy(true);
    setStatus('Sending…');
    try {
      setStatus(requestMessage(await requestVerification(email.trim())));
    } catch {
      setStatus('Network error — try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ padding: '1rem', maxWidth: 420 }}>
      <h1>Sign in</h1>
      <p>Enter your university email and we&apos;ll send you a sign-in link.</p>
      <form onSubmit={(e) => void submit(e)}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          style={{ display: 'block', width: '100%', margin: '0.25rem 0 0.5rem', padding: '0.4rem' }}
        />
        <button type="submit" disabled={busy}>
          {busy ? 'Sending…' : 'Send sign-in link'}
        </button>
      </form>
      <p role="status" aria-live="polite" style={{ minHeight: '1.2em' }}>
        {status}
      </p>
    </main>
  );
}
