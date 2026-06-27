'use client';

// apps/web — report control for a selected cell. Collapsed to a "Report" button; expands to a reason
// field + send. Filing is participant-gated server-side (anonymous → "sign in to report").
import { useState } from 'react';
import { reportStatusMessage, submitReport } from './report-client';

export function ReportControl({ x, y }: { x: number; y: number }): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function send(): Promise<void> {
    if (reason.trim() === '') {
      setStatus('Please enter a reason.');
      return;
    }
    setBusy(true);
    setStatus('Sending…');
    try {
      setStatus(reportStatusMessage(await submitReport(`pixel:${x},${y}`, reason.trim())));
    } catch {
      setStatus('Network error — try again.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setStatus('');
        }}
      >
        Report
      </button>
    );
  }

  return (
    <span role="group" aria-label="Report this cell" style={{ display: 'inline-flex', gap: '0.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <input
        aria-label="Reason for the report"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason"
        disabled={busy}
        style={{ padding: '0.3rem' }}
      />
      <button type="button" onClick={() => void send()} disabled={busy}>
        {busy ? 'Sending…' : 'Send report'}
      </button>
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          setReason('');
          setStatus('');
        }}
        disabled={busy}
      >
        Cancel
      </button>
      <span role="status" aria-live="polite">
        {status}
      </span>
    </span>
  );
}
