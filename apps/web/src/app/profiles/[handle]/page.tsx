'use client';

// apps/web — public member profile (DC2: handle/display/role/joined + placement count; never email).
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { dto } from '@quad/core';
import { fetchProfile } from '@/content/content-client';
import { ContributionHeatmap } from '@/content/contribution-heatmap';
import { AppBar } from '@/components/ui/app-bar';
import { SessionBadge } from '@/auth/session-badge';
import { useTenant } from '@/components/tenant-provider';

type Scope = 'term' | 'lifetime';

export default function ProfilePage(): React.ReactElement {
  const params = useParams();
  const tenant = useTenant();
  const raw = params['handle'];
  const handle = typeof raw === 'string' ? raw : Array.isArray(raw) ? (raw[0] ?? '') : '';
  // undefined = loading, null = not found/error.
  const [data, setData] = useState<dto.ProfileResponse | null | undefined>(undefined);
  // Which placement count the stat card shows — both totals are real fields.
  const [scope, setScope] = useState<Scope>('term');

  useEffect(() => {
    if (!handle) return;
    let active = true;
    void fetchProfile(handle).then((d) => {
      if (active) setData(d);
    });
    return () => {
      active = false;
    };
  }, [handle]);

  const atHandle = data ? (data.handle.startsWith('@') ? data.handle : `@${data.handle}`) : '';
  const initial = (data?.handle.replace(/^@/, '')[0] ?? '?').toUpperCase();
  const pixelsShown = data ? (scope === 'term' ? data.currentTermPixelsPlaced : data.pixelsPlaced) : 0;

  return (
    <main className="quad-page">
      <p className="quad-board-label">Profile</p>
      <div className="quad-panel">
        <AppBar
          tenantLabel={tenant?.title ?? null}
          nav={[
            { label: 'Canvas', href: '/canvas' },
            { label: 'Profile', href: `/profiles/${handle}`, active: true },
            { label: 'Board', href: '/leaderboards' },
          ]}
          right={<SessionBadge />}
        />

        <div style={{ padding: 28 }}>
          {data === undefined && <p style={{ color: 'var(--muted)', fontSize: 18 }}>Loading…</p>}

          {data === null && (
            <>
              <h1 className="quad-pixel" style={{ fontSize: 20, color: 'var(--ink)', margin: 0 }}>
                Profile
              </h1>
              <p style={{ color: 'var(--muted)', fontSize: 18, marginTop: 12 }}>No such member in this canvas.</p>
            </>
          )}

          {data && (
            <>
              {/* Identity row: avatar + handle + scope toggle */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 18,
                  marginBottom: 24,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                  <div
                    className="quad-pixel"
                    aria-hidden="true"
                    style={{
                      width: 66,
                      height: 66,
                      flex: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'var(--qa)',
                      border: 'var(--border-component) solid var(--ink)',
                      color: '#fff',
                      fontSize: 22,
                    }}
                  >
                    {initial}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <h1 className="quad-pixel" style={{ fontSize: 20, color: 'var(--ink)', margin: 0 }}>
                        {data.displayName ?? atHandle}
                      </h1>
                      <span className="quad-badge">public handle</span>
                    </div>
                    {data.displayName ? (
                      <div style={{ fontSize: 18, color: 'var(--muted-tag)', marginTop: 7 }}>{atHandle}</div>
                    ) : null}
                    <div
                      style={{
                        fontSize: 20,
                        color: 'var(--muted-label)',
                        marginTop: 7,
                        textTransform: 'uppercase',
                        letterSpacing: '0.02em',
                      }}
                    >
                      {data.role} · Member since {new Date(data.joinedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div className="quad-segmented" role="group" aria-label="Pixel count range">
                  <button
                    type="button"
                    aria-pressed={scope === 'term'}
                    onClick={() => setScope('term')}
                    style={{ fontFamily: 'inherit' }}
                  >
                    This term
                  </button>
                  <button
                    type="button"
                    aria-pressed={scope === 'lifetime'}
                    onClick={() => setScope('lifetime')}
                    style={{ fontFamily: 'inherit' }}
                  >
                    Lifetime
                  </button>
                </div>
              </div>

              {/* Backed stats only — the design's Surviving/Streak/Longest/Favorite have no field. */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 18 }}>
                <div className="quad-card" style={{ padding: 18, flex: '0 1 220px' }}>
                  <div className="quad-stat-label">Pixels placed · {scope === 'term' ? 'This term' : 'Lifetime'}</div>
                  <div className="quad-stat-value" style={{ fontSize: 22, marginTop: 12 }}>
                    {pixelsShown}
                  </div>
                </div>
              </div>

              {/* Heatmap */}
              <div className="quad-card" style={{ padding: 22 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                    marginBottom: 18,
                  }}
                >
                  <h2 className="quad-pixel" style={{ fontSize: 16, color: 'var(--ink)', margin: 0 }}>
                    Heatmap
                  </h2>
                  <span style={{ fontSize: 18, color: 'var(--muted-tag)', textTransform: 'uppercase' }}>
                    {data.contributions.length} active days
                  </span>
                </div>
                <ContributionHeatmap contributions={data.contributions} />
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
