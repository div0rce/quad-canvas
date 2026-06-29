'use client';

// apps/web — leaderboard (DC2). Ranked top placers; each links to the member's public profile.
import { useEffect, useState } from 'react';
import type { dto } from '@quad/core';
import { fetchLeaderboard, ordinal } from '@/content/content-client';
import { AppBar } from '@/components/ui/app-bar';
import { SessionBadge } from '@/auth/session-badge';
import { useTenant } from '@/components/tenant-provider';

// Strip a leading "@" and return the first glyph, upper-cased — the avatar letter.
function avatarInitial(label: string): string {
  return (label.replace(/^@/, '')[0] ?? '?').toUpperCase();
}

export default function LeaderboardsPage(): React.ReactElement {
  const tenant = useTenant();
  // undefined = loading, null = error.
  const [data, setData] = useState<dto.LeaderboardResponse | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    void fetchLeaderboard().then((d) => {
      if (active) setData(d);
    });
    return () => {
      active = false;
    };
  }, []);

  const entries = data && data.entries.length > 0 ? data.entries : [];

  // Podium spotlight, visually ordered 2nd · 1st · 3rd, layered over the full ranking below.
  // Each cell is guarded so short lists (1–2 placers) still render. The only ranking metric is
  // pixelsPlaced; the design's "Surviving %" column/bar and the Surviving/Placed/Today/All-time
  // tabs have no backing field or API parameter (fetchLeaderboard takes none), so they are
  // omitted rather than fabricated.
  const podium: ReadonlyArray<{
    entry: dto.LeaderboardEntry | undefined;
    accent: string;
    avatarColor: string;
    elevated: boolean;
  }> = [
    { entry: entries[1], accent: 'var(--silver)', avatarColor: 'var(--ink)', elevated: false },
    { entry: entries[0], accent: 'var(--qa)', avatarColor: '#fff', elevated: true },
    { entry: entries[2], accent: 'var(--bronze)', avatarColor: '#fff', elevated: false },
  ];

  const rowCols = '60px minmax(0, 1fr) 110px';

  return (
    <main className="quad-page">
      <p className="quad-board-label">Leaderboards</p>
      <div className="quad-panel">
        <AppBar
          tenantLabel={tenant?.title ?? null}
          nav={[
            { label: 'Canvas', href: '/canvas' },
            { label: 'Board', href: '/leaderboards', active: true },
            { label: 'Archive', href: '/archives' },
          ]}
          right={<SessionBadge />}
        />

        <div style={{ padding: 28 }}>
          <header style={{ marginBottom: 22 }}>
            <h1 className="quad-pixel" style={{ fontSize: 22, color: 'var(--ink)', margin: 0 }}>
              Leaderboards
            </h1>
            <p style={{ fontSize: 21, color: 'var(--ink-soft)', margin: '9px 0 0' }}>
              Real attributable activity only. Bots and multi-accounts cannot climb.
            </p>
          </header>

          {data === undefined && <p style={{ fontSize: 21, color: 'var(--muted)' }}>Loading…</p>}
          {data === null && (
            <p style={{ fontSize: 21, color: 'var(--muted)' }}>Could not load the leaderboard.</p>
          )}
          {data && data.entries.length === 0 && (
            <p style={{ fontSize: 21, color: 'var(--muted)' }}>No placements yet.</p>
          )}

          {entries.length > 0 && (
            <>
              {/* Podium — presentational highlight; the canonical ranking is the list below. */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1.1fr 1fr',
                  gap: 14,
                  alignItems: 'end',
                  marginBottom: 22,
                }}
              >
                {podium.map((slot, i) => {
                  const e = slot.entry;
                  if (!e) return <div key={i} />;
                  const name = e.displayName ?? e.handle;
                  const avatarSize = slot.elevated ? 58 : 48;
                  return (
                    <div
                      key={i}
                      className={slot.elevated ? 'quad-card quad-card--lg' : 'quad-card'}
                      style={{
                        padding: slot.elevated ? 24 : 20,
                        textAlign: 'center',
                        ...(slot.elevated
                          ? {
                              background: 'var(--qa-tint2)',
                              borderWidth: 'var(--border-structural)',
                            }
                          : null),
                      }}
                    >
                      <div
                        className="quad-avatar"
                        style={{
                          width: avatarSize,
                          height: avatarSize,
                          margin: '0 auto',
                          background: slot.accent,
                          color: slot.avatarColor,
                          fontSize: slot.elevated ? 20 : 16,
                        }}
                      >
                        {avatarInitial(name)}
                      </div>
                      <div
                        className="quad-pixel"
                        style={{
                          fontSize: 13,
                          color: slot.elevated ? 'var(--qa)' : 'var(--ink-soft)',
                          marginTop: 14,
                        }}
                      >
                        {ordinal(e.rank)}
                      </div>
                      <a
                        href={`/profiles/${encodeURIComponent(e.handle)}`}
                        style={{
                          display: 'block',
                          fontSize: slot.elevated ? 22 : 21,
                          color: 'var(--ink)',
                          textDecoration: 'none',
                          marginTop: 6,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {name}
                      </a>
                      <div
                        className="quad-pixel"
                        style={{
                          fontSize: slot.elevated ? 22 : 16,
                          color: 'var(--ink)',
                          marginTop: 8,
                        }}
                      >
                        {e.pixelsPlaced}
                      </div>
                      {slot.elevated && (
                        <div
                          style={{
                            fontSize: 16,
                            color: 'var(--ink-soft)',
                            marginTop: 8,
                            textTransform: 'uppercase',
                          }}
                        >
                          pixels placed
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Full ranking. */}
              <div className="quad-card" style={{ overflow: 'hidden' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: rowCols,
                    padding: '11px 20px',
                    background: 'var(--paper)',
                    borderBottom: 'var(--border-component) solid var(--ink)',
                  }}
                >
                  <span className="quad-stat-label">Rank</span>
                  <span className="quad-stat-label">Member</span>
                  <span className="quad-stat-label" style={{ textAlign: 'right' }}>
                    Pixels
                  </span>
                </div>
                <ol style={{ listStyle: 'none', margin: 0, padding: 0 }} aria-label="Top placers">
                  {entries.map((e, i) => {
                    const name = e.displayName ?? e.handle;
                    return (
                      <li
                        key={e.handle}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: rowCols,
                          alignItems: 'center',
                          padding: '12px 20px',
                          borderBottom:
                            i < entries.length - 1 ? '2px solid var(--hairline)' : undefined,
                        }}
                      >
                        <span className="quad-pixel" style={{ fontSize: 15, color: 'var(--ink)' }}>
                          {e.rank}
                        </span>
                        <span
                          style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}
                        >
                          <span
                            className="quad-avatar"
                            style={{ width: 30, height: 30, fontSize: 11, flex: 'none' }}
                          >
                            {avatarInitial(name)}
                          </span>
                          <a
                            href={`/profiles/${encodeURIComponent(e.handle)}`}
                            style={{
                              fontSize: 20,
                              color: 'var(--ink)',
                              textDecoration: 'none',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {name}
                          </a>
                        </span>
                        <span
                          className="quad-pixel"
                          style={{ fontSize: 14, color: 'var(--ink)', textAlign: 'right' }}
                        >
                          {e.pixelsPlaced}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
