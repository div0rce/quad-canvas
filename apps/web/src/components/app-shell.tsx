'use client';

import { useTenant } from '@/components/tenant-provider';

/** Presentational shell only — no business logic beyond composition (T8). */
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
          <p>
            Viewing <strong>{tenant.title}</strong>.
          </p>
        ) : (
          <p>
            This host is not configured for any tenant. There is no default tenant — add a host in{' '}
            <code>@quad/config</code> to map it.
          </p>
        )}
        <p className="quad-note">
          Shell only — the canvas, authentication, and realtime updates are not wired up yet.
        </p>
      </section>
    </main>
  );
}
