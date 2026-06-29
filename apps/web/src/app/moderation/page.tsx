'use client';

// apps/web — moderator console. Lists the report queue and resolves/dismisses reports. The server
// enforces the moderator role; non-moderators get a clear access message (no actions rendered).
import { useCallback, useEffect, useState } from 'react';
import type { dto } from '@quad/core';
import { actionMessage, actOnReport, fetchReports, queueMessage, type ReportAction } from '@/moderation/moderation-client';
import { AppBar } from '@/components/ui/app-bar';
import { useTenant } from '@/components/tenant-provider';

async function readQueue(): Promise<{ reports: dto.ReportQueueResponse; message: string }> {
  const { status, data } = await fetchReports();
  return {
    reports: data ?? { data: [], page: { nextCursor: null, limit: 0 } },
    message: queueMessage(status),
  };
}

// Best-effort "x ago" from an ISO-8601 timestamp — presentational only, derived from real createdAt.
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function ModerationPage(): React.ReactElement {
  const tenant = useTenant();
  // undefined = loading.
  const [reports, setReports] = useState<dto.ReportQueueResponse | undefined>(undefined);
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const next = await readQueue();
    setReports(next.reports);
    setMessage(next.message);
  }, []);

  useEffect(() => {
    let active = true;
    void readQueue().then((next) => {
      if (!active) return;
      setReports(next.reports);
      setMessage(next.message);
    });
    return () => {
      active = false;
    };
  }, []);

  const act = useCallback(
    async (id: string, action: ReportAction) => {
      if (busyId) return; // one action at a time
      setBusyId(id);
      try {
        const code = await actOnReport(id, action);
        await load(); // refresh the queue first...
        setMessage(actionMessage(code)); // ...then show the outcome (so the refresh doesn't clear it)
      } catch {
        setMessage('Network error — try again.');
      } finally {
        setBusyId(null);
      }
    },
    [busyId, load],
  );

  const hasReports = reports !== undefined && reports.data.length > 0;

  return (
    <main className="quad-page">
      <p className="quad-board-label">Moderation / Reports &amp; audit</p>
      <div className="quad-panel">
        <AppBar
          variant="dark"
          tenantLabel={tenant?.title ?? null}
          right={
            <span
              style={{
                fontSize: 18,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--muted-faint)',
              }}
            >
              Tenant scoped / every action audited
            </span>
          }
        />

        <div style={{ padding: 24 }}>
          <header
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
              marginBottom: 20,
            }}
          >
            <div>
              <h1 className="quad-pixel" style={{ fontSize: 18, color: 'var(--ink)', margin: 0 }}>
                Report queue
              </h1>
              <p style={{ fontSize: 20, color: 'var(--ink-soft)', margin: '9px 0 0' }}>
                Resolve or dismiss open reports. Removal hides a placement; it never destroys history.
              </p>
            </div>
            <a href="/policy" className="quad-btn" style={{ flex: 'none' }}>
              Content policy ▸
            </a>
          </header>

          {message && (
            <p
              role="status"
              aria-live="polite"
              style={{
                margin: '0 0 18px',
                padding: '11px 16px',
                fontSize: 20,
                color: 'var(--ink)',
                background: 'var(--paper)',
                border: 'var(--border-component) solid var(--ink)',
                boxShadow: 'var(--shadow-xs)',
              }}
            >
              {message}
            </p>
          )}

          {/* Single honest stat — the count of the loaded open queue. The design's Resolved-7d /
              Hard-deleted / In-review figures have no counts API, so they are omitted, not faked. */}
          {hasReports && (
            <div
              className="quad-card"
              style={{ display: 'inline-flex', flexDirection: 'column', padding: '14px 18px', marginBottom: 20 }}
            >
              <span className="quad-stat-value" style={{ fontSize: 22, color: 'var(--pumpkin)' }}>
                {reports.data.length}
              </span>
              <span className="quad-stat-label" style={{ marginTop: 8 }}>
                Open reports
              </span>
            </div>
          )}

          {reports === undefined && <p style={{ fontSize: 20, color: 'var(--muted)' }}>Loading…</p>}
          {reports && reports.data.length === 0 && !message && (
            <p style={{ fontSize: 20, color: 'var(--muted)' }}>No reports.</p>
          )}

          {hasReports && (
            <ul
              style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 14 }}
              aria-label="Reports"
            >
              {reports.data.map((r) => {
                const isOpen = r.status === 'open';
                const when = timeAgo(r.createdAt);
                return (
                  <li key={r.id} className="quad-card" style={{ padding: '16px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span
                        className="quad-badge"
                        style={isOpen ? { background: 'var(--pumpkin)', color: 'var(--ink)' } : undefined}
                      >
                        {r.status}
                      </span>
                      <code style={{ fontSize: 20, color: 'var(--ink)' }}>{r.targetRef}</code>
                      {when && (
                        <time
                          dateTime={r.createdAt}
                          style={{ marginLeft: 'auto', fontSize: 16, color: 'var(--muted)' }}
                        >
                          {when}
                        </time>
                      )}
                    </div>
                    <p style={{ fontSize: 20, color: 'var(--ink-strong)', margin: '9px 0 0' }}>{r.reason}</p>
                    {isOpen && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 13 }}>
                        <button
                          type="button"
                          className="quad-btn quad-btn--primary"
                          onClick={() => void act(r.id, 'resolve_report')}
                          disabled={busyId !== null}
                        >
                          Resolve
                        </button>
                        <button
                          type="button"
                          className="quad-btn"
                          onClick={() => void act(r.id, 'dismiss_report')}
                          disabled={busyId !== null}
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {/* Static policy note (from the design's audit panel). The audit-log timeline itself has no
              fetch API, so the feed of entries is omitted — only this standing copy is rendered. */}
          <p
            style={{
              marginTop: 24,
              paddingTop: 16,
              borderTop: 'var(--border-component) solid var(--hairline)',
              fontSize: 18,
              color: 'var(--ink-strong)',
              lineHeight: 1.45,
            }}
          >
            Every action records actor, target, reason, and time. Removal hides. It never destroys history.
          </p>
        </div>
      </div>
    </main>
  );
}
