'use client';

// On mount, sends a signed-in visitor to `to`. Used on the public landing so members skip straight
// to their dashboard while signed-out visitors stay on the marketing page. The server stays
// authoritative — this is a convenience route, not a gate.
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchSession } from '@/auth/auth-client';

export function SignedInRedirect({ to }: { readonly to: string }): null {
  const router = useRouter();
  useEffect(() => {
    let active = true;
    void fetchSession().then((s) => {
      if (active && s.authenticated) router.replace(to);
    });
    return () => {
      active = false;
    };
  }, [router, to]);
  return null;
}
