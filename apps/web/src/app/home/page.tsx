'use client';

// apps/web — the signed-in dashboard (/home). Welcome hero + the canvas card, plus the member's
// active guild (with its current-term credit), the top guilds, friends activity, and the live
// on-canvas feed. All DC2; identity comes from GET /session. Visitors are routed to the landing
// and handle-less members to onboarding.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { dto } from '@quad/core';
import { fetchSession, type SessionInfo } from '@/auth/auth-client';
import { fetchProfile } from '@/content/content-client';
import { AppBar } from '@/components/ui/app-bar';
import { mainNav } from '@/components/main-nav';
import { SessionBadge } from '@/auth/session-badge';
import { useTenant } from '@/components/tenant-provider';
import { boardSize, fetchCanvasMeta, fetchRecentPlacements, statsSummary, welcomeName } from '@/home/home-client';
import { fetchFriendActivity } from '@/friends/friends-client';
import { fetchGuilds } from '@/guilds/guilds-client';

const NAV = mainNav();

export default function HomePage(): React.ReactElement {
  const router = useRouter();
  const tenant = useTenant();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [profile, setProfile] = useState<dto.ProfileResponse | null>(null);
  const [canvas, setCanvas] = useState<dto.CanvasMetaResponse | null>(null);
  const [guilds, setGuilds] = useState<readonly dto.GuildSummary[]>([]);
  const [activity, setActivity] = useState<readonly dto.FriendActivityItem[]>([]);
  const [feed, setFeed] = useState<readonly dto.CanvasRecentPlacement[]>([]);

  useEffect(() => {
    let active = true;
    void fetchSession().then((s) => {
      if (!active) return;
      if (!s.authenticated) {
        router.replace('/'); // /home is for members; send visitors to the landing
        return;
      }
      if (!s.handle) {
        router.replace('/onboarding'); // a new member who hasn't picked a handle yet
        return;
      }
      setSession(s);
      void fetchProfile(s.handle.replace(/^@/, '')).then((p) => active && setProfile(p));
      void fetchGuilds().then((g) => active && setGuilds(g));
      void fetchFriendActivity().then((a) => active && setActivity(a));
    });
    void fetchCanvasMeta().then((c) => active && setCanvas(c));
    void fetchRecentPlacements(5).then((f) => active && setFeed(f));
    return () => {
      active = false;
    };
  }, [router]);

  const activeGuild = profile?.activeGuild ?? null;
  const topGuilds = guilds.slice(0, 3);

  const handle = (session?.handle ?? '').replace(/^@/, '');
  const profileHref = handle ? `/profiles/${encodeURIComponent(handle)}` : '/profiles/me';
  const initial = (handle[0] ?? '?').toUpperCase();
  const size = boardSize(canvas);

  return (
    <main className="quad-page">
      <div className="quad-panel quad-home">
        <AppBar tenantLabel={tenant?.title ?? null} nav={NAV} right={<SessionBadge />} />

        {!session ? (
          <p className="quad-home__loading" role="status">
            Loading your dashboard…
          </p>
        ) : (
          <>
            <header className="quad-home__hero">
              <h1 className="quad-pixel quad-home__welcome">Welcome back, {welcomeName(handle, profile?.displayName)}</h1>
              <p className="quad-home__subtitle">
                {canvas ? `${tenant?.title ?? 'Quad'} · ${canvas.term} is live. Your next pixel is ready.` : `${tenant?.title ?? 'Quad'} · your next pixel is ready.`}
              </p>
            </header>

            <div className="quad-home__grid">
              <Link href="/canvas" className="quad-card quad-home__canvas-card">
                <div className="quad-home__card-head">
                  <span className="quad-eyebrow">The canvas</span>
                  {canvas?.status === 'active' ? (
                    <span className="quad-home__live">
                      <span aria-hidden className="quad-home__live-dot" /> LIVE
                    </span>
                  ) : null}
                </div>
                <div className="quad-home__canvas-title">{tenant?.title ?? 'Quad'} pixel war</div>
                <dl className="quad-home__stats">
                  <div>
                    <dt>Board</dt>
                    <dd>{size ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Term</dt>
                    <dd>{canvas?.term ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Your pixel</dt>
                    <dd>Ready</dd>
                  </div>
                </dl>
                <span className="quad-btn quad-btn--primary quad-home__cta">Enter the canvas →</span>
              </Link>

              <Link href={profileHref} className="quad-card quad-home__profile-card">
                <span className="quad-eyebrow">Your profile</span>
                <div className="quad-home__profile-row">
                  <span className="quad-avatar quad-home__profile-avatar" aria-hidden>
                    {initial}
                  </span>
                  <div>
                    <div className="quad-home__profile-handle">@{handle || 'you'}</div>
                    <div className="quad-home__profile-stats">{statsSummary(profile)}</div>
                  </div>
                </div>
                <span className="quad-home__profile-link">View profile →</span>
              </Link>
            </div>

            <div className="quad-home__lower">
              <Link
                href={activeGuild ? `/guilds/${encodeURIComponent(activeGuild.slug)}` : '/guilds'}
                className="quad-card quad-home__card"
              >
                <span className="quad-eyebrow">Active guild</span>
                {activeGuild ? (
                  <>
                    <div className="quad-home__card-title">{activeGuild.name}</div>
                    <div className="quad-home__card-meta">
                      #{activeGuild.placerRank} placer · {activeGuild.guildPixels.toLocaleString('en-US')} guild pixels
                    </div>
                    <span className="quad-home__profile-link">Your pixels count for {activeGuild.name} →</span>
                  </>
                ) : (
                  <>
                    <div className="quad-home__card-meta">No guild yet — fly a flag with your pixels.</div>
                    <span className="quad-home__profile-link">Browse guilds →</span>
                  </>
                )}
              </Link>

              <div className="quad-card quad-home__card">
                <div className="quad-home__card-head">
                  <span className="quad-eyebrow">Guilds</span>
                  <Link className="quad-home__profile-link" href="/guilds">
                    All
                  </Link>
                </div>
                {topGuilds.length === 0 ? (
                  <div className="quad-home__card-meta">No guilds yet.</div>
                ) : (
                  <ol className="quad-home__list">
                    {topGuilds.map((g) => (
                      <li key={g.slug}>
                        <span className="quad-home__list-rank">#{g.rank}</span>
                        <Link href={`/guilds/${encodeURIComponent(g.slug)}`}>{g.name}</Link>
                        <span className="quad-home__list-meta">{g.pixels.toLocaleString('en-US')} px</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              <div className="quad-card quad-home__card">
                <div className="quad-home__card-head">
                  <span className="quad-eyebrow">Friends activity</span>
                  <Link className="quad-home__profile-link" href="/friends">
                    All
                  </Link>
                </div>
                {activity.length === 0 ? (
                  <div className="quad-home__card-meta">
                    Quiet so far. <Link href="/friends/add">Add friends</Link> to see their pixels.
                  </div>
                ) : (
                  <ul className="quad-home__list">
                    {activity.slice(0, 4).map((a, i) => (
                      <li key={`${a.handle}-${a.placedAt}-${i}`}>
                        <Link href={`/profiles/${encodeURIComponent(a.handle)}`}>@{a.handle}</Link>
                        <span className="quad-home__list-meta">
                          placed at ({a.at.x}, {a.at.y})
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="quad-card quad-home__card">
                <div className="quad-home__card-head">
                  <span className="quad-eyebrow">On the canvas</span>
                  <span className="quad-home__live">
                    <span aria-hidden className="quad-home__live-dot" /> LIVE
                  </span>
                </div>
                {feed.length === 0 ? (
                  <div className="quad-home__card-meta">No placements yet — be the first.</div>
                ) : (
                  <ul className="quad-home__list">
                    {feed.slice(0, 4).map((p) => (
                      <li key={String(p.seq)}>
                        <span>{p.owner?.handle ? `@${String(p.owner.handle).replace(/^@/, '')}` : 'Someone'}</span>
                        <span className="quad-home__list-meta">
                          ({p.at.x}, {p.at.y})
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
