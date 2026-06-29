// apps/web — archives read client. Past terms: a list, plus a term's final-state snapshot + replay
// derivation metadata. Public reads (same tenant-host constraint as the rest of the web app).
import type { dto } from '@quad/core';
import { fetchAllPages } from '@/lib/fetch-all-pages';

const API_BASE = process.env['NEXT_PUBLIC_API_BASE'] ?? '';

/** A read that distinguishes a real 404 (terminal "not found") from a transient failure (retryable). */
export type FetchOutcome<T> =
  | { readonly status: 'ok'; readonly data: T }
  | { readonly status: 'missing' }
  | { readonly status: 'error' };

function isArchiveSummary(value: unknown): value is dto.ArchiveSummary {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item['id'] === 'string' &&
    typeof item['term'] === 'string' &&
    typeof item['status'] === 'string' &&
    typeof item['width'] === 'number' &&
    typeof item['height'] === 'number' &&
    typeof item['createdAt'] === 'string'
  );
}

export async function fetchArchives(): Promise<dto.ArchiveListResponse | null> {
  try {
    return await fetchAllPages(`${API_BASE}/api/v1/archives?limit=200`, undefined, isArchiveSummary);
  } catch {
    return null;
  }
}

export async function fetchArchiveSnapshot(term: string): Promise<FetchOutcome<dto.CanvasSnapshotResponse>> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/archives/${encodeURIComponent(term)}/snapshot`);
    if (res.ok) return { status: 'ok', data: (await res.json()) as dto.CanvasSnapshotResponse };
    return { status: res.status === 404 ? 'missing' : 'error' };
  } catch {
    return { status: 'error' }; // network/transient — retryable, not "not found"
  }
}

export async function fetchArchiveAt(term: string, seq: number): Promise<dto.CanvasSnapshotResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/archives/${encodeURIComponent(term)}/at/${seq}`);
    return res.ok ? ((await res.json()) as dto.CanvasSnapshotResponse) : null;
  } catch {
    return null;
  }
}

export async function fetchArchiveStats(term: string): Promise<dto.ArchiveStatsResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/archives/${encodeURIComponent(term)}/stats`);
    return res.ok ? ((await res.json()) as dto.ArchiveStatsResponse) : null;
  } catch {
    return null;
  }
}

export async function fetchReplayMeta(term: string): Promise<FetchOutcome<dto.ReplayMetaResponse>> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/archives/${encodeURIComponent(term)}/replay`);
    if (res.ok) return { status: 'ok', data: (await res.json()) as dto.ReplayMetaResponse };
    return { status: res.status === 404 ? 'missing' : 'error' };
  } catch {
    return { status: 'error' }; // network/transient — retryable, not "not found"
  }
}
