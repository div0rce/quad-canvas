// apps/web — archives read client. Past terms: a list, plus a term's final-state snapshot + replay
// derivation metadata. Public reads (same tenant-host constraint as the rest of the web app).
import type { dto } from '@quad/core';

const API_BASE = process.env['NEXT_PUBLIC_API_BASE'] ?? '';

/** A read that distinguishes a real 404 (terminal "not found") from a transient failure (retryable). */
export type FetchOutcome<T> =
  | { readonly status: 'ok'; readonly data: T }
  | { readonly status: 'missing' }
  | { readonly status: 'error' };

export async function fetchArchives(): Promise<dto.ArchiveListResponse | null> {
  try {
    // Request the max page (newest first). Terms accumulate slowly; >200 would need cursor paging.
    const res = await fetch(`${API_BASE}/api/v1/archives?limit=200`);
    return res.ok ? ((await res.json()) as dto.ArchiveListResponse) : null;
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
