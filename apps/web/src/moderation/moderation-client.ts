// apps/web — moderator console client. Reads the moderator-gated report queue and resolves/dismisses
// reports. Server enforces the moderator role (403 for everyone else); this is display + actions.
import type { dto } from '@quad/core';
import { fetchAllPages } from '@/lib/fetch-all-pages';

const API_BASE = process.env['NEXT_PUBLIC_API_BASE'] ?? '';
const pendingActionKeys = new Map<string, string>();

export type ReportAction = 'resolve_report' | 'dismiss_report';

function isReportItem(value: unknown): value is dto.ReportItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item['id'] === 'string' &&
    typeof item['targetRef'] === 'string' &&
    typeof item['reason'] === 'string' &&
    typeof item['status'] === 'string' &&
    typeof item['createdAt'] === 'string'
  );
}

export async function fetchReports(): Promise<{ status: number; data: dto.ReportQueueResponse | null }> {
  try {
    // Only the actionable (open) reports — resolved/dismissed ones stay out of the console.
    const first = await fetch(`${API_BASE}/api/v1/moderation/reports?status=open&limit=200`, { credentials: 'include' });
    if (!first.ok) return { status: first.status, data: null };
    const data = await fetchAllPages(
      `${API_BASE}/api/v1/moderation/reports?status=open&limit=200`,
      { credentials: 'include' },
      isReportItem,
      first,
    );
    return { status: data ? 200 : 502, data };
  } catch {
    return { status: 0, data: null };
  }
}

export async function actOnReport(reportId: string, action: ReportAction): Promise<number> {
  const reason = action === 'resolve_report' ? 'resolved via moderator console' : 'dismissed via moderator console';
  const intent = JSON.stringify([reportId, action, reason]);
  const key = pendingActionKeys.get(intent) ?? crypto.randomUUID();
  pendingActionKeys.set(intent, key);
  const res = await fetch(`${API_BASE}/api/v1/moderation/actions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': key },
    credentials: 'include',
    body: JSON.stringify({ actionType: action, targetRef: reportId, reason }),
  });
  if (res.status < 500) pendingActionKeys.delete(intent);
  return res.status;
}

/** Message for a failed/blocked queue load (empty string when it loaded fine). */
export function queueMessage(status: number): string {
  switch (status) {
    case 200:
      return '';
    case 401:
      return 'Sign in as a moderator to view the queue.';
    case 403:
      return 'Moderator access required.';
    case 404:
      return 'No canvas for this host.';
    default:
      return 'Could not load the report queue.';
  }
}

/** Message after a resolve/dismiss action. */
export function actionMessage(status: number): string {
  switch (status) {
    case 200:
      return 'Done.';
    case 401:
      return 'Sign in as a moderator.';
    case 403:
      return 'Moderator access required.';
    case 404:
      return 'Report not found.';
    default:
      return 'Action failed. Try again.';
  }
}
