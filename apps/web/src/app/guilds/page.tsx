'use client';

// apps/web — guild directory. Browse the tenant's guilds; join one, then set it active. Member-gated.
// Guilds are social/identity only (no placement advantage).
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { dto } from '@quad/core';
import { fetchSession } from '@/auth/auth-client';
import { fetchGuilds, guildActionLabel, joinGuild, setActiveGuild } from '@/guilds/guilds-client';
import { AppBar } from '@/components/ui/app-bar';
import { SessionBadge } from '@/auth/session-badge';
import { useTenant } from '@/components/tenant-provider';

const NAV = [
  { label: 'Home', href: '/home' },
  { label: 'Guilds', href: '/guilds', active: true },
  { label: 'Canvas', href: '/canvas' },
];

export default function GuildsPage(): React.ReactElement {
  const router = useRouter();
  const tenant = useTenant();
  const [ready, setReady] = useState(false);
  const [guilds, setGuilds] = useState<readonly dto.GuildSummary[]>([]);

  const refresh = useCallback(() => {
    void fetchGuilds().then(setGuilds);
  }, []);

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

  const onAction = useCallback(
    async (g: dto.GuildSummary) => {
      if (g.active) return;
      const ok = g.joined ? await setActiveGuild(g.slug) : await joinGuild(g.slug);
      if (ok) refresh();
    },
    [refresh],
  );

  return (
    <main className="quad-page">
      <div className="quad-panel">
        <AppBar tenantLabel={tenant?.title ?? null} nav={NAV} right={<SessionBadge />} />
        <div className="quad-friends">
          <header className="quad-friends__head">
            <div>
              <h1 className="quad-pixel">Guilds</h1>
              <p className="quad-friends__note">Teams are cosmetic — your pixel is yours, guilds just fly a flag.</p>
            </div>
            <Link className="quad-btn quad-btn--primary" href="/guilds/new">
              Create a guild
            </Link>
          </header>

          {!ready ? (
            <p className="quad-friends__note" role="status">
              Loading…
            </p>
          ) : (
            <ul className="quad-friends__list" aria-label="Guilds">
              {guilds.length === 0 ? (
                <li className="quad-friends__empty">No guilds yet. Create the first one.</li>
              ) : (
                guilds.map((g) => (
                  <li key={g.slug} className="quad-friends__row quad-guild__row">
                    <span className="quad-friends__row-main">
                      <Link href={`/guilds/${encodeURIComponent(g.slug)}`}>{g.name}</Link>
                      <span className="quad-friends__display">
                        {g.memberCount} {g.memberCount === 1 ? 'member' : 'members'}
                        {g.description ? ` · ${g.description}` : ''}
                      </span>
                    </span>
                    <button
                      type="button"
                      className={g.active ? 'quad-btn' : 'quad-btn quad-btn--primary'}
                      disabled={g.active}
                      onClick={() => void onAction(g)}
                    >
                      {guildActionLabel(g)}
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
