'use client';

// apps/web — leaderboard (DC2). Ranked top placers/survivors; each links to the member's public profile.
import { useEffect, useMemo, useState } from 'react';
import type { dto } from '@quad/core';
import { fetchLeaderboard, ordinal, type LeaderboardCategory, type LeaderboardWindow } from '@/content/content-client';
import { AppBar } from '@/components/ui/app-bar';
import { mainNav } from '@/components/main-nav';
import { SessionBadge } from '@/auth/session-badge';
import { useTenant } from '@/components/tenant-provider';

function avatarInitial(label: string): string {
  return (label.replace(/^@/, '')[0] ?? '?').toUpperCase();
}

function entryName(entry: dto.LeaderboardEntry): string {
  return entry.displayName ?? `@${entry.handle.replace(/^@/, '')}`;
}

function scoreLabel(category: LeaderboardCategory): string {
  return category === 'surviving' ? 'Surviving' : 'Placed';
}

function windowLabel(window: LeaderboardWindow): string {
  return window === 'today' ? 'Today' : 'All time';
}

export default function LeaderboardsPage(): React.ReactElement {
  const tenant = useTenant();
  const [category, setCategory] = useState<LeaderboardCategory>('surviving');
  const [window, setWindow] = useState<LeaderboardWindow>('all');
  // undefined = loading, null = error.
  const [data, setData] = useState<dto.LeaderboardResponse | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    void fetchLeaderboard({ category, window, limit: 50 }).then((next) => {
      if (active) setData(next);
    });
    return () => {
      active = false;
    };
  }, [category, window]);

  const entries = useMemo(() => data?.entries ?? [], [data]);
  const maxScore = Math.max(1, ...entries.map((entry) => entry.score));
  const podium = useMemo(
    () =>
      [
        { entry: entries[1], accent: 'var(--silver)', avatarColor: 'var(--ink)', elevated: false },
        { entry: entries[0], accent: 'var(--qa)', avatarColor: '#fff', elevated: true },
        { entry: entries[2], accent: 'var(--bronze)', avatarColor: '#fff', elevated: false },
      ] as const,
    [entries],
  );
  const label = scoreLabel(category);

  return (
    <main className="quad-page">
      <p className="quad-board-label">Leaderboards</p>
      <div className="quad-panel">
        <AppBar
          tenantLabel={tenant?.title ?? null}
          nav={mainNav('leaderboard')}
          right={<SessionBadge />}
        />

        <div className="quad-leaderboard">
          <header className="quad-leaderboard__header">
            <div>
              <h1 className="quad-pixel">Leaderboards</h1>
              <p>Real attributable activity only. Bots and multi-accounts cannot climb.</p>
            </div>
            <div className="quad-leaderboard__filters" aria-label="Leaderboard filters">
              <div className="quad-segmented">
                <button type="button" aria-pressed={category === 'surviving'} onClick={() => setCategory('surviving')}>
                  Surviving
                </button>
                <button type="button" aria-pressed={category === 'placements'} onClick={() => setCategory('placements')}>
                  Placed
                </button>
              </div>
              <div className="quad-segmented">
                <button type="button" aria-pressed={window === 'today'} onClick={() => setWindow('today')}>
                  Today
                </button>
                <button type="button" aria-pressed={window === 'all'} onClick={() => setWindow('all')}>
                  All time
                </button>
              </div>
            </div>
          </header>

          {data === undefined && <p className="quad-leaderboard__state">Loading...</p>}
          {data === null && <p className="quad-leaderboard__state">Could not load the leaderboard.</p>}
          {data && data.entries.length === 0 && <p className="quad-leaderboard__state">No placements yet.</p>}

          {entries.length > 0 && (
            <>
              <div className="quad-leaderboard__podium">
                {podium.map((slot, i) => {
                  const entry = slot.entry;
                  if (!entry) return <div key={i} />;
                  const name = entryName(entry);
                  const avatarSize = slot.elevated ? 58 : 48;
                  return (
                    <article key={entry.handle} className={slot.elevated ? 'quad-card quad-card--lg' : 'quad-card'}>
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
                      <div className="quad-pixel quad-leaderboard__rank" style={{ color: slot.elevated ? 'var(--qa)' : 'var(--ink-soft)' }}>
                        {ordinal(entry.rank)}
                      </div>
                      <a href={`/profiles/${encodeURIComponent(entry.handle)}`}>{name}</a>
                      <div className="quad-pixel quad-leaderboard__score">{entry.score.toLocaleString()}</div>
                      {slot.elevated && <div className="quad-leaderboard__metric">{label} pixels</div>}
                    </article>
                  );
                })}
              </div>

              <div className="quad-card quad-leaderboard__table">
                <div className="quad-leaderboard__row quad-leaderboard__row--head">
                  <span className="quad-stat-label">Rank</span>
                  <span className="quad-stat-label">Student</span>
                  <span className="quad-stat-label">{label}</span>
                  <span className="quad-stat-label" style={{ textAlign: 'right' }}>
                    Pixels
                  </span>
                </div>
                <ol aria-label={`${label} leaderboard, ${windowLabel(window)}`}>
                  {entries.map((entry, i) => {
                    const name = entryName(entry);
                    return (
                      <li
                        key={entry.handle}
                        className="quad-leaderboard__row"
                        style={{
                          borderBottom: i < entries.length - 1 ? '2px solid var(--hairline)' : undefined,
                        }}
                      >
                        <span className="quad-pixel quad-leaderboard__place">{entry.rank}</span>
                        <span className="quad-leaderboard__member">
                          <span className="quad-avatar">{avatarInitial(name)}</span>
                          <a href={`/profiles/${encodeURIComponent(entry.handle)}`}>{name}</a>
                        </span>
                        <span className="quad-leaderboard__bar" aria-label={`${entry.score} ${label.toLowerCase()} pixels`}>
                          <span style={{ width: `${Math.max(4, (entry.score / maxScore) * 100)}%` }} />
                        </span>
                        <span className="quad-pixel quad-leaderboard__pixels">{entry.score.toLocaleString()}</span>
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
