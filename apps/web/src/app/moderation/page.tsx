'use client';

// apps/web — moderator console. Lists the report queue and resolves/dismisses reports. The server
// enforces the moderator role; non-moderators get a clear access message (no actions rendered).
import { useCallback, useEffect, useState } from 'react';
import type { dto } from '@quad/core';
import { actionMessage, actOnReport, fetchReports, queueMessage, type ReportAction } from '@/moderation/moderation-client';

export default function ModerationPage(): React.ReactElement {
  // undefined = loading.
  const [reports, setReports] = useState<dto.ReportQueueResponse | undefined>(undefined);
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { status, data } = await fetchReports();
    setReports(data ?? { data: [], page: { nextCursor: null, limit: 0 } });
    setMessage(queueMessage(status));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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

  return (
    <main style={{ padding: '1rem', maxWidth: 640 }}>
      <h1>Moderation queue</h1>
      {message && (
        <p role="status" aria-live="polite">
          {message}
        </p>
      )}
      {reports === undefined && <p>Loading…</p>}
      {reports && reports.data.length === 0 && !message && <p>No reports.</p>}
      {reports && reports.data.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0 }} aria-label="Reports">
          {reports.data.map((r) => (
            <li key={r.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid #eee', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <code>{r.targetRef}</code>
              <span style={{ flex: 1 }}>{r.reason}</span>
              <em>{r.status}</em>
              {r.status === 'open' && (
                <span style={{ display: 'flex', gap: '0.25rem' }}>
                  <button type="button" onClick={() => void act(r.id, 'resolve_report')} disabled={busyId !== null}>
                    Resolve
                  </button>
                  <button type="button" onClick={() => void act(r.id, 'dismiss_report')} disabled={busyId !== null}>
                    Dismiss
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
