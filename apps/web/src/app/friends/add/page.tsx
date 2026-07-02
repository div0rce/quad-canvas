'use client';

// apps/web — add friends. Search active members by public handle (never email); Add sends a request
// that toggles to "Requested" until the other member confirms. Member-gated.
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { dto } from '@quad/core';
import { fetchSession } from '@/auth/auth-client';
import { addButtonLabel, acceptFriendRequest, cancelFriendRequest, searchFriends, sendFriendRequest } from '@/friends/friends-client';
import { AppBar } from '@/components/ui/app-bar';
import { SessionBadge } from '@/auth/session-badge';
import { useTenant } from '@/components/tenant-provider';

const NAV = [
  { label: 'Home', href: '/home' },
  { label: 'Friends', href: '/friends' },
  { label: 'Canvas', href: '/canvas' },
];

export default function AddFriendsPage(): React.ReactElement {
  const router = useRouter();
  const tenant = useTenant();
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<readonly dto.FriendSearchResult[]>([]);
  const [pending, setPending] = useState<Record<string, dto.FriendRelationship>>({});

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

  // Debounced search as you type. An empty query shows nothing (derived below) without a setState.
  useEffect(() => {
    if (!ready) return undefined;
    const q = query.trim();
    if (q === '') return undefined;
    let active = true;
    const id = setTimeout(() => {
      void searchFriends(q).then((r) => active && setResults(r));
    }, 200);
    return () => {
      active = false;
      clearTimeout(id);
    };
  }, [query, ready]);

  const shown = query.trim() === '' ? [] : results;
  const relationshipFor = (r: dto.FriendSearchResult): dto.FriendRelationship => pending[r.handle] ?? r.relationship;

  const onAdd = useCallback(async (r: dto.FriendSearchResult) => {
    const current = pending[r.handle] ?? r.relationship;
    const next =
      current === 'outgoing'
        ? await cancelFriendRequest(r.handle) // tap again to cancel
        : current === 'incoming'
          ? await acceptFriendRequest(r.handle)
          : await sendFriendRequest(r.handle);
    if (next) setPending((p) => ({ ...p, [r.handle]: next }));
  }, [pending]);

  return (
    <main className="quad-page">
      <div className="quad-panel">
        <AppBar tenantLabel={tenant?.title ?? null} nav={NAV} right={<SessionBadge />} />
        <div className="quad-friends">
          <header className="quad-friends__head">
            <h1 className="quad-pixel">Add friends</h1>
            <Link className="quad-btn" href="/friends">
              Your friends
            </Link>
          </header>
          <p className="quad-friends__note">Find people by their public handle. We never show or search emails.</p>
          <input
            className="quad-friends__search"
            type="search"
            placeholder="Search a handle…"
            aria-label="Search members by handle"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
          <ul className="quad-friends__list" aria-label="Search results">
            {shown.length === 0 && query.trim() !== '' ? (
              <li className="quad-friends__empty">No members match “{query.trim()}”.</li>
            ) : (
              shown.map((r) => {
                const rel = relationshipFor(r);
                return (
                  <li key={r.handle} className="quad-friends__row">
                    <span className="quad-avatar quad-friends__avatar" aria-hidden>
                      {r.handle[0]?.toUpperCase() ?? '?'}
                    </span>
                    <span className="quad-friends__row-main">
                      <Link href={`/profiles/${encodeURIComponent(r.handle)}`}>@{r.handle}</Link>
                      {r.displayName ? <span className="quad-friends__display">{r.displayName}</span> : null}
                    </span>
                    <button
                      type="button"
                      className={rel === 'friends' ? 'quad-btn' : 'quad-btn quad-btn--primary'}
                      disabled={rel === 'friends' || rel === 'self'}
                      onClick={() => void onAdd(r)}
                    >
                      {addButtonLabel(rel)}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </div>
    </main>
  );
}
