'use client';

// apps/web — profile settings. Change your public username (@handle) and display name; the same
// rules as onboarding (3–24 chars; unique within the campus). Member-gated; DC2 only.
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchSession } from '@/auth/auth-client';
import { handleValidationError, updateProfile } from '@/onboarding/onboarding-client';
import { fetchProfile } from '@/content/content-client';
import { AppBar } from '@/components/ui/app-bar';
import { mainNav } from '@/components/main-nav';
import { SessionBadge } from '@/auth/session-badge';
import { useTenant } from '@/components/tenant-provider';

export default function SettingsPage(): React.ReactElement {
  const router = useRouter();
  const tenant = useTenant();
  const [ready, setReady] = useState(false);
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void fetchSession().then((s) => {
      if (!active) return;
      if (!s.authenticated) {
        router.replace('/');
        return;
      }
      setReady(true);
      const current = (s.handle ?? '').replace(/^@/, '');
      setHandle(current);
      if (current) {
        void fetchProfile(current).then((p) => {
          if (active && p?.displayName) setDisplayName(p.displayName);
        });
      }
    });
    return () => {
      active = false;
    };
  }, [router]);

  const liveHandleError = handle.trim() !== '' ? handleValidationError(handle) : null;

  const onSave = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const invalid = handleValidationError(handle);
      if (invalid) {
        setError(invalid);
        return;
      }
      setBusy(true);
      setError('');
      setMessage('');
      const res = await updateProfile({ handle: handle.trim().replace(/^@/, ''), displayName });
      setBusy(false);
      if (res.ok) {
        setMessage('Saved. Your public identity is updated.');
        // The session badge reads /session on focus; a reload reflects the new handle everywhere.
        setTimeout(() => window.location.reload(), 600);
      } else {
        setError(res.error ?? 'Could not save.');
      }
    },
    [handle, displayName],
  );

  return (
    <main className="quad-page">
      <div className="quad-panel">
        <AppBar tenantLabel={tenant?.title ?? null} nav={mainNav()} right={<SessionBadge />} />
        <div className="quad-friends">
          <header className="quad-friends__head">
            <h1 className="quad-pixel">Profile settings</h1>
            <Link className="quad-btn" href="/home">
              Back to home
            </Link>
          </header>
          <p className="quad-friends__note">Your @username is your public identity — never your email. Changing it renames you everywhere.</p>
          {ready ? (
            <form className="quad-guild__form" onSubmit={(e) => void onSave(e)}>
              <label className="quad-guild__label" htmlFor="settings-handle">
                Username
              </label>
              <div className="quad-onb__handle">
                <span aria-hidden>@</span>
                <input
                  id="settings-handle"
                  className="quad-friends__search"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  autoComplete="off"
                  required
                />
              </div>
              <p className="quad-onb__hint">{liveHandleError ?? '3–24 characters: letters, numbers, underscores, or hyphens.'}</p>
              <label className="quad-guild__label" htmlFor="settings-display">
                Display name <span className="quad-guild__optional">(optional; blank removes it)</span>
              </label>
              <input
                id="settings-display"
                className="quad-friends__search"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={48}
                autoComplete="off"
              />
              {error ? (
                <p className="quad-guild__error" role="alert">
                  {error}
                </p>
              ) : null}
              {message ? (
                <p className="quad-settings__saved" role="status">
                  {message}
                </p>
              ) : null}
              <button type="submit" className="quad-btn quad-btn--primary" disabled={busy || liveHandleError !== null || handle.trim() === ''}>
                {busy ? 'Saving…' : 'Save changes'}
              </button>
            </form>
          ) : (
            <p className="quad-friends__note" role="status">
              Loading…
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
