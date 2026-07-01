// apps/web — report filing (participant-gated server-side; no anonymous reports). targetRef
// identifies what's reported (e.g. "pixel:x,y"); the reason is required.
import { apiPath } from '@/lib/api-base';

const pendingReportKeys = new Map<string, string>();

export async function submitReport(targetRef: string, reason: string): Promise<number> {
  const intent = JSON.stringify([targetRef, reason]);
  const key = pendingReportKeys.get(intent) ?? crypto.randomUUID();
  pendingReportKeys.set(intent, key);
  const res = await fetch(apiPath('/api/v1/reports'), {
    method: 'POST',
    // Idempotency key so a retry (network hiccup / double submit) returns the original report instead
    // of filing a duplicate in the moderator queue (same pattern as placement).
    headers: { 'content-type': 'application/json', 'idempotency-key': key },
    credentials: 'include',
    body: JSON.stringify({ targetRef, reason }),
  });
  // A transport failure or 5xx is ambiguous: preserve the key so a user retry cannot duplicate a
  // command that committed before its response was lost. A non-5xx response is definitive.
  if (res.status < 500) pendingReportKeys.delete(intent);
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
