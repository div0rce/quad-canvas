'use client';

// apps/web — public member profile. DC2 only: handle/display/role/public activity, never email.
// Signed-in viewers get a relationship-aware Add-friend action; the member's active guild (and its
// current-term credit) links to the guild profile.
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { dto } from '@quad/core';
import { colorHexForValue, colorNameForValue } from '@quad/config';
import { fetchProfile } from '@/content/content-client';
import { ContributionHeatmap } from '@/content/contribution-heatmap';
import { AppBar } from '@/components/ui/app-bar';
import { mainNav } from '@/components/main-nav';
import { SessionBadge } from '@/auth/session-badge';
import { useTenant } from '@/components/tenant-provider';
import { fetchSession } from '@/auth/auth-client';
import {
  acceptFriendRequest,
  addButtonLabel,
  cancelFriendRequest,
  fetchRelationship,
  sendFriendRequest,
} from '@/friends/friends-client';

type Scope = 'term' | 'lifetime';

function atHandle(handle: string): string {
  return handle.startsWith('@') ? handle : `@${handle}`;
}

function memberSince(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'UNKNOWN';
  const month = date.getUTCMonth();
  const season = month <= 4 ? 'SPRING' : month <= 7 ? 'SUMMER' : 'FALL';
  return `${season} ${date.getUTCFullYear()}`;
}

function schoolName(title: string | null | undefined): string {
  return (title ?? 'Campus').replace(/\s+Quad$/i, '');
}

function canvasCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'CANVAS' : 'CANVASES'} PARTICIPATED`;
}

function dayLabel(days: number): string {
  return `${days}d`;
}

function StatCard({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}): React.ReactElement {
  return (
    <article className="quad-profile__stat">
      <div className="quad-stat-label">{label}</div>
      {children}
    </article>
  );
}

function FavoriteColor({
  palette,
  value,
}: {
  readonly palette: string;
  readonly value: number | undefined;
}): React.ReactElement {
  if (value === undefined) {
    return <div className="quad-profile__empty-value">None yet</div>;
  }
  return (
    <div className="quad-profile__favorite">
      <span className="quad-profile__swatch" style={{ background: colorHexForValue(palette, value) }} />
      <span>{colorNameForValue(palette, value)}</span>
    </div>
  );
}

function RecentPlacements({
  palette,
  placements,
}: {
  readonly palette: string;
  readonly placements: readonly dto.ProfileRecentPlacement[];
}): React.ReactElement {
  return (
    <section className="quad-profile-card quad-profile-recent" aria-labelledby="recent-placements-title">
      <h2 id="recent-placements-title" className="quad-profile-card__title">
        Recent
      </h2>
      {placements.length > 0 ? (
        <ol className="quad-profile-recent__list">
          {placements.map((placement) => (
            <li key={placement.id} className="quad-profile-recent__row">
              <span className="quad-profile__swatch" style={{ background: colorHexForValue(palette, placement.color) }} />
              <span className="quad-profile-recent__coord">
                ({placement.at.x}, {placement.at.y})
              </span>
              <span
                className={
                  placement.surviving
                    ? 'quad-profile-recent__status quad-profile-recent__status--surviving'
                    : 'quad-profile-recent__status quad-profile-recent__status--overwritten'
                }
              >
                {placement.surviving ? 'Surviving' : 'Overwritten'}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="quad-profile-recent__empty">No public placements yet.</p>
      )}
      <p className="quad-profile-recent__note">
        You control what is public. Defaults show only your handle, never your email.
      </p>
    </section>
  );
}

export default function ProfilePage(): React.ReactElement {
  const params = useParams();
  const tenant = useTenant();
  const raw = params['handle'];
  const handle = typeof raw === 'string' ? raw : Array.isArray(raw) ? (raw[0] ?? '') : '';
  const [data, setData] = useState<dto.ProfileResponse | null | undefined>(undefined);
  const [scope, setScope] = useState<Scope>('term');
  const [relationship, setRelationship] = useState<dto.FriendRelationship | null>(null);
  const [relationshipBusy, setRelationshipBusy] = useState(false);

  useEffect(() => {
    if (!handle) return;
    let active = true;
    void fetchProfile(handle).then((profile) => {
      if (active) setData(profile);
    });
    // Only a signed-in viewer has a relationship to show (self → no button).
    void fetchSession().then((s) => {
      if (!active || !s.authenticated) return;
      void fetchRelationship(handle).then((rel) => {
        if (active) setRelationship(rel);
      });
    });
    return () => {
      active = false;
    };
  }, [handle]);

  const onFriendAction = useCallback(async () => {
    if (relationship === null || relationship === 'self' || relationship === 'friends' || relationshipBusy) return;
    setRelationshipBusy(true);
    const next =
      relationship === 'outgoing'
        ? await cancelFriendRequest(handle) // tap again to cancel
        : relationship === 'incoming'
          ? await acceptFriendRequest(handle)
          : await sendFriendRequest(handle);
    setRelationshipBusy(false);
    if (next) setRelationship(next);
  }, [relationship, relationshipBusy, handle]);

  const palette = tenant?.palette ?? 'default';
  const stats = data ? (scope === 'term' ? data.currentTermStats : data.lifetimeStats) : null;
  const displayHandle = data ? atHandle(data.handle) : atHandle(handle);
  const initial = (data?.handle.replace(/^@/, '')[0] ?? handle[0] ?? '?').toUpperCase();
  const activeDays = data?.contributions.filter((entry) => entry.count > 0).length ?? 0;

  return (
    <main className="quad-page">
      <p className="quad-board-label">Profile</p>
      <div className="quad-panel">
        <AppBar
          tenantLabel={tenant?.title ?? null}
          nav={mainNav()}
          right={<SessionBadge />}
        />

        <div className="quad-profile">
          {data === undefined && <p className="quad-profile__state">Loading...</p>}

          {data === null && (
            <section className="quad-profile__state">
              <h1 className="quad-pixel">Profile</h1>
              <p>No such member in this canvas.</p>
            </section>
          )}

          {data && stats && (
            <>
              <header className="quad-profile__hero">
                <div className="quad-profile__identity">
                  <div className="quad-profile__mark quad-pixel" aria-hidden="true">
                    {initial}
                  </div>
                  <div className="quad-profile__name-block">
                    <div className="quad-profile__handle-row">
                      <h1 className="quad-profile__handle quad-pixel">{displayHandle}</h1>
                      <span className="quad-badge">Public handle</span>
                      {relationship === 'self' ? (
                        <Link className="quad-btn" href="/settings">
                          Edit profile
                        </Link>
                      ) : relationship !== null ? (
                        <button
                          type="button"
                          className={relationship === 'friends' ? 'quad-btn' : 'quad-btn quad-btn--primary'}
                          disabled={relationship === 'friends' || relationshipBusy}
                          onClick={() => void onFriendAction()}
                        >
                          {addButtonLabel(relationship)}
                        </button>
                      ) : null}
                    </div>
                    {data.displayName ? <p className="quad-profile__display-name">{data.displayName}</p> : null}
                    <p className="quad-profile__meta">
                      Member since {memberSince(data.joinedAt)} / {schoolName(tenant?.title).toUpperCase()} /{' '}
                      {canvasCountLabel(stats.canvasesParticipated)}
                    </p>
                    {data.activeGuild ? (
                      <Link href={`/guilds/${encodeURIComponent(data.activeGuild.slug)}`} className="quad-profile__guild-chip">
                        <span className="quad-badge">{data.activeGuild.name}</span>
                        <span className="quad-profile__guild-meta">
                          {data.activeGuild.guildPixels.toLocaleString('en-US')} guild px · #{data.activeGuild.placerRank} placer
                        </span>
                      </Link>
                    ) : null}
                  </div>
                </div>

                <div className="quad-segmented" role="group" aria-label="Profile stats range">
                  <button type="button" aria-pressed={scope === 'term'} onClick={() => setScope('term')}>
                    This term
                  </button>
                  <button type="button" aria-pressed={scope === 'lifetime'} onClick={() => setScope('lifetime')}>
                    Lifetime
                  </button>
                </div>
              </header>

              <div className="quad-profile__stats" aria-label={`${scope === 'term' ? 'This term' : 'Lifetime'} profile stats`}>
                <StatCard label="Pixels placed">
                  <div className="quad-profile__stat-value quad-pixel">{stats.pixelsPlaced}</div>
                </StatCard>
                <StatCard label="Surviving">
                  <div className="quad-profile__stat-value quad-pixel">{stats.survivingPixels}</div>
                </StatCard>
                <StatCard label="Streak">
                  <div className="quad-profile__stat-value quad-pixel">{dayLabel(stats.streakDays)}</div>
                </StatCard>
                <StatCard label="Longest">
                  <div className="quad-profile__stat-value quad-pixel">{dayLabel(stats.longestStreakDays)}</div>
                </StatCard>
                <StatCard label="Favorite">
                  <FavoriteColor palette={palette} value={stats.favoriteColor} />
                </StatCard>
              </div>

              <div className="quad-profile__content">
                <section className="quad-profile-card quad-profile-heat" aria-labelledby="profile-heatmap-title">
                  <div className="quad-profile-card__head">
                    <h2 id="profile-heatmap-title" className="quad-profile-card__title">
                      Most Recent
                    </h2>
                    <span>{activeDays} active days</span>
                  </div>
                  <ContributionHeatmap contributions={data.contributions} />
                </section>

                <RecentPlacements palette={palette} placements={data.recentPlacements} />
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
