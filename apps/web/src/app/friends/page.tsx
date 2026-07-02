'use client';

// apps/web — friends area. Confirmed friends + pending requests in both directions. Member-gated;
// DC2 only, no email, no DMs. Accept incoming, cancel outgoing, remove a friend.
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { dto } from '@quad/core';
import { fetchSession } from '@/auth/auth-client';
import { acceptFriendRequest, cancelFriendRequest, fetchFriends, removeFriend } from '@/friends/friends-client';
import { AppBar } from '@/components/ui/app-bar';
import { SessionBadge } from '@/auth/session-badge';
import { useTenant } from '@/components/tenant-provider';

const NAV = [
  { label: 'Home', href: '/home' },
  { label: 'Friends', href: '/friends', active: true },
  { label: 'Canvas', href: '/canvas' },
];

function MemberRow({
  member,
  action,
}: {
  readonly member: dto.FriendMember;
  readonly action: React.ReactNode;
}): React.ReactElement {
  return (
    <li className="quad-friends__row">
      <span className="quad-avatar quad-friends__avatar" aria-hidden>
        {member.handle[0]?.toUpperCase() ?? '?'}
      </span>
      <span className="quad-friends__row-main">
        <Link href={`/profiles/${encodeURIComponent(member.handle)}`}>@{member.handle}</Link>
        {member.displayName ? <span className="quad-friends__display">{member.displayName}</span> : null}
      </span>
      {action}
    </li>
  );
}

export default function FriendsPage(): React.ReactElement {
  const router = useRouter();
  const tenant = useTenant();
  const [data, setData] = useState<dto.FriendsResponse | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(() => {
    void fetchFriends().then(setData);
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

  const act = useCallback(
    async (fn: (handle: string) => Promise<unknown>, handle: string) => {
      await fn(handle);
      refresh();
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
              <h1 className="quad-pixel">Friends</h1>
              {data ? (
                <p className="quad-friends__note">{data.counts.friends} friends · see what your campus circle is drawing.</p>
              ) : null}
            </div>
            <Link className="quad-btn quad-btn--primary" href="/friends/add">
              Add friends
            </Link>
          </header>

          {!ready ? (
            <p className="quad-friends__note" role="status">
              Loading…
            </p>
          ) : (
            <>
              {data && data.incoming.length > 0 ? (
                <section aria-label="Requests">
                  <h2 className="quad-eyebrow">Requests</h2>
                  <ul className="quad-friends__list">
                    {data.incoming.map((m) => (
                      <MemberRow
                        key={m.handle}
                        member={m}
                        action={
                          <button type="button" className="quad-btn quad-btn--primary" onClick={() => void act(acceptFriendRequest, m.handle)}>
                            Accept
                          </button>
                        }
                      />
                    ))}
                  </ul>
                </section>
              ) : null}

              <section aria-label="Your friends">
                <h2 className="quad-eyebrow">Your friends</h2>
                <ul className="quad-friends__list">
                  {data && data.friends.length > 0 ? (
                    data.friends.map((m) => (
                      <MemberRow
                        key={m.handle}
                        member={m}
                        action={
                          <button type="button" className="quad-btn quad-friends__remove" onClick={() => void act(removeFriend, m.handle)}>
                            Remove
                          </button>
                        }
                      />
                    ))
                  ) : (
                    <li className="quad-friends__empty">No friends yet. Add someone by their handle.</li>
                  )}
                </ul>
              </section>

              {data && data.outgoing.length > 0 ? (
                <section aria-label="Sent requests">
                  <h2 className="quad-eyebrow">Sent</h2>
                  <ul className="quad-friends__list">
                    {data.outgoing.map((m) => (
                      <MemberRow
                        key={m.handle}
                        member={m}
                        action={
                          <button type="button" className="quad-btn" onClick={() => void act(cancelFriendRequest, m.handle)}>
                            Requested · cancel
                          </button>
                        }
                      />
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
