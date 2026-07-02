'use client';

// The root route: routing only (design page map). Signed-in members go to /home; visitors go to the
// /welcome landing. The server stays authoritative — this is a convenience router, not a gate.
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchSession } from '@/auth/auth-client';

export default function RootRouter(): React.ReactElement {
  const router = useRouter();
  useEffect(() => {
    let active = true;
    void fetchSession().then((s) => {
      if (active) router.replace(s.authenticated ? '/home' : '/welcome');
    });
    return () => {
      active = false;
    };
  }, [router]);
  return (
    <main className="quad-page">
      <p className="quad-sr-only" role="status">
        Loading…
      </p>
    </main>
  );
}
