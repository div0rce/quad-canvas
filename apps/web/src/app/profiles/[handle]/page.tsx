'use client';

// apps/web — public member profile (DC2: handle/display/role/joined + placement count; never email).
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { dto } from '@quad/core';
import { fetchProfile } from '@/content/content-client';

export default function ProfilePage(): React.ReactElement {
  const params = useParams();
  const raw = params['handle'];
  const handle = typeof raw === 'string' ? raw : Array.isArray(raw) ? (raw[0] ?? '') : '';
  // undefined = loading, null = not found/error.
  const [data, setData] = useState<dto.ProfileResponse | null | undefined>(undefined);

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

  return (
    <main style={{ padding: '1rem', maxWidth: 420 }}>
      {data === undefined && <p>Loading…</p>}
      {data === null && (
        <>
          <h1>Profile</h1>
          <p>No such member in this canvas.</p>
        </>
      )}
      {data && (
        <>
          <h1>{data.displayName ?? data.handle}</h1>
          <dl>
            <dt>Handle</dt>
            <dd>{data.handle}</dd>
            <dt>Role</dt>
            <dd>{data.role}</dd>
            <dt>Pixels placed (this term)</dt>
            <dd>{data.currentTermPixelsPlaced}</dd>
            <dt>Pixels placed (lifetime)</dt>
            <dd>{data.pixelsPlaced}</dd>
            <dt>Joined</dt>
            <dd>{new Date(data.joinedAt).toLocaleDateString()}</dd>
          </dl>
        </>
      )}
    </main>
  );
}
