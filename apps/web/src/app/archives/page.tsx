'use client';

// apps/web — archives index. Lists past-term canvases; each links to its final-state view.
import { useEffect, useState } from 'react';
import type { dto } from '@quad/core';
import { fetchArchives } from '@/archives/archives-client';
import { AppBar } from '@/components/ui/app-bar';
import { mainNav } from '@/components/main-nav';
import { SessionBadge } from '@/auth/session-badge';
import { useTenant } from '@/components/tenant-provider';

// Statuses that read as a finished/sealed term get the green completion badge. The archives list
// endpoint only ever returns canvases whose status is 'archived', but render the real value rather
// than hardcoding a label, so any future terminal status stays honest.
const DONE_STATUSES = new Set(['archived', 'complete', 'completed', 'frozen', 'sealed', 'closed']);
const isComplete = (status: string): boolean => DONE_STATUSES.has(status.toLowerCase());
const titleCase = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export default function ArchivesPage(): React.ReactElement {
  const tenant = useTenant();
  const [data, setData] = useState<dto.ArchiveListResponse | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    void fetchArchives().then((d) => {
      if (active) setData(d);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="quad-page">
      <p className="quad-board-label">Archives / Past terms</p>
      <div className="quad-panel">
        <AppBar
          tenantLabel={tenant?.title ?? null}
          nav={mainNav('archive')}
          right={<SessionBadge />}
        />
        <div style={{ padding: 'clamp(16px, 4vw, 28px)' }}>
          <header style={{ marginBottom: 22 }}>
            <h1 className="quad-pixel" style={{ fontSize: 22, color: 'var(--ink)', margin: 0 }}>
              Years of history
            </h1>
            <p style={{ fontSize: 21, color: 'var(--ink-soft)', margin: '9px 0 0', maxWidth: 640 }}>
              Every completed term is archived forever — a final image, statistics, and a full replay. Nothing is ever deleted.
            </p>
          </header>

          {data === undefined && <p style={{ fontSize: 21, color: 'var(--muted)' }}>Loading…</p>}
          {data === null && <p style={{ fontSize: 21, color: 'var(--live-red)' }}>Could not load archives.</p>}
          {data && data.data.length === 0 && <p style={{ fontSize: 21, color: 'var(--muted)' }}>No past terms yet.</p>}

          {data && data.data.length > 0 && (
            <>
              <ul
                aria-label="Past terms"
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                  gap: 18,
                }}
              >
                {data.data.map((a) => (
                  <li
                    key={a.id}
                    className="quad-card quad-card--card"
                    style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
                  >
                    {/* Decorative thumbnail tile — the list summary carries no snapshot, so we never
                        fetch a per-card preview; show the real canvas dimensions faintly instead. */}
                    <div
                      style={{
                        background: 'var(--canvas-well)',
                        borderBottom: 'var(--border-component) solid var(--ink)',
                        height: 132,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <span className="quad-pixel" style={{ fontSize: 13, color: 'var(--muted-faint)' }}>
                        {a.width} × {a.height}
                      </span>
                    </div>
                    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                        <span className="quad-pixel" style={{ fontSize: 15, color: 'var(--ink)' }}>
                          {a.term}
                        </span>
                        <span
                          className="quad-badge"
                          style={isComplete(a.status) ? { background: 'var(--live-green)', color: '#fff' } : undefined}
                        >
                          {titleCase(a.status)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 9, marginTop: 'auto' }}>
                        <a
                          className="quad-btn quad-btn--primary"
                          href={`/archives/${encodeURIComponent(a.term)}/replay`}
                          aria-label={`Watch the ${a.term} replay`}
                          style={{ flex: 1 }}
                        >
                          Watch replay
                        </a>
                        <a
                          className="quad-btn"
                          href={`/archives/${encodeURIComponent(a.term)}`}
                          aria-label={`${a.term} final image`}
                        >
                          Image
                        </a>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginTop: 20,
                  padding: '14px 18px',
                  background: 'var(--surface)',
                  border: 'var(--border-component) solid var(--ink)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ width: 16, height: 13, border: '3px solid var(--qa)', flex: 'none' }} />
                <span style={{ fontSize: 20, color: 'var(--ink-strong)' }}>
                  Every archive has a stable, shareable reference — for example{' '}
                  <span style={{ color: 'var(--ink)' }}>
                    {tenant?.title ? `${tenant.title} Quad` : 'Quad'} / {data.data[0]?.term}
                  </span>
                  . Permanent and immutable.
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
