'use client';

import Link from 'next/link';
import { useTenant } from '@/components/tenant-provider';

/** Tenant-aware landing page — no business logic beyond composition. */
export function AppShell() {
  const tenant = useTenant();
  return (
    <main className="quad-shell">
      <header className="quad-header">
        <span className="quad-brand">Quad</span>
        {tenant ? (
          <span className="quad-tenant">{tenant.title}</span>
        ) : (
          <span className="quad-tenant quad-tenant--unknown">Unknown tenant</span>
        )}
      </header>

      <section className="quad-body">
        {tenant ? (
          <>
            <p>
              Viewing <strong>{tenant.title}</strong>.
            </p>
            <nav aria-label="Explore Quad" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <Link href="/canvas">Open live canvas</Link>
              <Link href="/leaderboards">Leaderboard</Link>
              <Link href="/archives">Archives</Link>
              <Link href="/signin">Sign in</Link>
            </nav>
          </>
        ) : (
          <p>
            This host is not configured for any tenant. There is no default tenant — add a host in{' '}
            <code>@quad/config</code> to map it.
          </p>
        )}
      </section>
    </main>
  );
}
