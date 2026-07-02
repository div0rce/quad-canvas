'use client';

// apps/web — create a guild. Name (drives the slug) + optional description. On success you join it
// and it becomes your active guild. Member-gated.
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchSession } from '@/auth/auth-client';
import { createGuild } from '@/guilds/guilds-client';
import { AppBar } from '@/components/ui/app-bar';
import { SessionBadge } from '@/auth/session-badge';
import { useTenant } from '@/components/tenant-provider';

const NAV = [
  { label: 'Home', href: '/home' },
  { label: 'Guilds', href: '/guilds' },
  { label: 'Canvas', href: '/canvas' },
];

export default function NewGuildPage(): React.ReactElement {
  const router = useRouter();
  const tenant = useTenant();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    void fetchSession().then((s) => {
      if (!active) return;
      if (!s.authenticated) router.replace('/');
      else setReady(true);
    });
    return () => {
      active = false;
    };
  }, [router]);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (name.trim() === '' || submitting) return;
      setSubmitting(true);
      setError('');
      const res = await createGuild(name, description);
      setSubmitting(false);
      if (res.ok && res.slug) router.push(`/guilds/${res.slug}`);
      else setError(res.error ?? 'Could not create the guild.');
    },
    [name, description, submitting, router],
  );

  return (
    <main className="quad-page">
      <div className="quad-panel">
        <AppBar tenantLabel={tenant?.title ?? null} nav={NAV} right={<SessionBadge />} />
        <div className="quad-friends">
          <header className="quad-friends__head">
            <h1 className="quad-pixel">Create a guild</h1>
            <Link className="quad-btn" href="/guilds">
              All guilds
            </Link>
          </header>
          <p className="quad-friends__note">A guild is a team badge — social only, no placement advantage.</p>
          {ready ? (
            <form className="quad-guild__form" onSubmit={(e) => void onSubmit(e)}>
              <label className="quad-guild__label" htmlFor="guild-name">
                Name
              </label>
              <input
                id="guild-name"
                className="quad-friends__search"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={48}
                autoComplete="off"
                required
              />
              <label className="quad-guild__label" htmlFor="guild-desc">
                Description <span className="quad-guild__optional">(optional)</span>
              </label>
              <textarea
                id="guild-desc"
                className="quad-friends__search quad-guild__textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={280}
                rows={3}
              />
              {error ? (
                <p className="quad-guild__error" role="alert">
                  {error}
                </p>
              ) : null}
              <button type="submit" className="quad-btn quad-btn--primary" disabled={name.trim() === '' || submitting}>
                {submitting ? 'Creating…' : 'Create guild'}
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
