// apps/web — report filing (participant-gated server-side; no anonymous reports). targetRef
// identifies what's reported (e.g. "pixel:x,y"); the reason is required.
const API_BASE = process.env['NEXT_PUBLIC_API_BASE'] ?? '';

export async function submitReport(targetRef: string, reason: string): Promise<number> {
  const res = await fetch(`${API_BASE}/api/v1/reports`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ targetRef, reason }),
  });
  return res.status;
}

/** Map a report response to a user message. */
export function reportStatusMessage(status: number): string {
  switch (status) {
    case 201:
      return 'Report submitted — thank you.';
    case 401:
      return 'Sign in to report.';
    case 422:
      return 'Please enter a reason.';
    case 429:
      return 'Too many reports — slow down.';
    default:
      return 'Could not submit the report. Try again.';
  }
}
