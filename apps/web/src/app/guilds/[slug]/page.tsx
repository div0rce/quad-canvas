'use client';

// apps/web — guild profile. Details + members + membership actions (join, set active, leave).
// Member-gated; DC2 only.
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { dto } from '@quad/core';
import { fetchSession } from '@/auth/auth-client';
import { fetchGuild, joinGuild, leaveGuild, setActiveGuild } from '@/guilds/guilds-client';
import { AppBar } from '@/components/ui/app-bar';
import { SessionBadge } from '@/auth/session-badge';
import { useTenant } from '@/components/tenant-provider';

const NAV = [
  { label: 'Home', href: '/home' },
  { label: 'Guilds', href: '/guilds' },
  { label: 'Canvas', href: '/canvas' },
];

export default function GuildProfilePage(): React.ReactElement {
  const router = useRouter();
  const tenant = useTenant();
  const params = useParams<{ slug: string }>();
  const slug = typeof params.slug === 'string' ? params.slug : '';
  const [ready, setReady] = useState(false);
  const [guild, setGuild] = useState<dto.GuildDetailResponse | null>(null);
  const [missing, setMissing] = useState(false);

  const refresh = useCallback(() => {
    void fetchGuild(slug).then((g) => {
      setGuild(g);
      setMissing(g === null);
    });
  }, [slug]);

  useEffect(() => {
    let active = true;
    void fetchSession().then((s) => {
      if (!active) return;
      if (!s.authenticated) {
        router.replace('/');
        return;
      }
      setReady(true);
      refresh();
    });
    return () => {
      active = false;
    };
  }, [router, refresh]);

  const act = useCallback(
    async (fn: (s: string) => Promise<boolean>) => {
      if (await fn(slug)) refresh();
    },
    [slug, refresh],
  );

  return (
    <main className="quad-page">
      <div className="quad-panel">
        <AppBar tenantLabel={tenant?.title ?? null} nav={NAV} right={<SessionBadge />} />
        <div className="quad-friends">
          <header className="quad-friends__head">
            <Link className="quad-btn" href="/guilds">
              ← All guilds
            </Link>
          </header>

          {!ready ? (
            <p className="quad-friends__note" role="status">
              Loading…
            </p>
          ) : missing || !guild ? (
            <p className="quad-friends__empty">No such guild.</p>
          ) : (
            <>
              <div className="quad-guild__header">
                <div>
                  <h1 className="quad-pixel">{guild.name}</h1>
                  <p className="quad-friends__note">
                    #{guild.rank} · {guild.pixels.toLocaleString('en-US')} guild pixels · {guild.memberCount}{' '}
                    {guild.memberCount === 1 ? 'member' : 'members'}
                    {guild.active ? ' · your active guild' : ''}
                  </p>
                  {guild.description ? <p className="quad-guild__desc">{guild.description}</p> : null}
                </div>
                <div className="quad-guild__actions">
                  {!guild.joined ? (
                    <button type="button" className="quad-btn quad-btn--primary" onClick={() => void act(joinGuild)}>
                      Join
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="quad-btn quad-btn--primary"
                        disabled={guild.active}
                        onClick={() => void act(setActiveGuild)}
                      >
                        {guild.active ? 'Active' : 'Set active'}
                      </button>
                      <button type="button" className="quad-btn quad-friends__remove" onClick={() => void act(leaveGuild)}>
                        Leave
                      </button>
                    </>
                  )}
                </div>
              </div>

              <h2 className="quad-eyebrow">Members</h2>
              <ul className="quad-friends__list">
                {guild.members.map((m) => (
                  <li key={m.handle} className="quad-friends__row">
                    <span className="quad-avatar quad-friends__avatar" aria-hidden>
                      {m.handle[0]?.toUpperCase() ?? '?'}
                    </span>
                    <span className="quad-friends__row-main">
                      <Link href={`/profiles/${encodeURIComponent(m.handle)}`}>@{m.handle}</Link>
                      {m.displayName ? <span className="quad-friends__display">{m.displayName}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
