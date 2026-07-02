'use client';

// apps/web — the signed-in dashboard (/home). Welcomes the member and gives one-tap routes into the
// live canvas and their profile. Reads existing public endpoints (canvas meta, DC2 profile); the
// identity comes from GET /session. Signed-out visitors are sent to sign in. Guild + friend cards
// arrive with those features.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { dto } from '@quad/core';
import { fetchSession, type SessionInfo } from '@/auth/auth-client';
import { fetchProfile } from '@/content/content-client';
import { AppBar } from '@/components/ui/app-bar';
import { SessionBadge } from '@/auth/session-badge';
import { useTenant } from '@/components/tenant-provider';
import { boardSize, fetchCanvasMeta, statsSummary, welcomeName } from '@/home/home-client';

const NAV = [
  { label: 'Home', href: '/home', active: true },
  { label: 'Canvas', href: '/canvas' },
  { label: 'Guilds', href: '/guilds' },
  { label: 'Leaderboard', href: '/leaderboards' },
  { label: 'Archive', href: '/archives' },
];

export default function HomePage(): React.ReactElement {
  const router = useRouter();
  const tenant = useTenant();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [profile, setProfile] = useState<dto.ProfileResponse | null>(null);
  const [canvas, setCanvas] = useState<dto.CanvasMetaResponse | null>(null);

  useEffect(() => {
    let active = true;
    void fetchSession().then((s) => {
      if (!active) return;
      if (!s.authenticated) {
        router.replace('/'); // /home is for members; send visitors to the landing
        return;
      }
      setSession(s);
      if (s.handle) void fetchProfile(s.handle.replace(/^@/, '')).then((p) => active && setProfile(p));
    });
    void fetchCanvasMeta().then((c) => active && setCanvas(c));
    return () => {
      active = false;
    };
  }, [router]);

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
          </>
        )}
      </div>
    </main>
  );
}
