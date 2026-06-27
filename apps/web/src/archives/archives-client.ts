// apps/web — archives read client. Past terms: a list, plus a term's final-state snapshot + replay
// derivation metadata. Public reads (same tenant-host constraint as the rest of the web app).
import type { dto } from '@quad/core';

const API_BASE = process.env['NEXT_PUBLIC_API_BASE'] ?? '';

export async function fetchArchives(): Promise<dto.ArchiveListResponse | null> {
  try {
    // Request the max page (newest first). Terms accumulate slowly; >200 would need cursor paging.
    const res = await fetch(`${API_BASE}/api/v1/archives?limit=200`);
    return res.ok ? ((await res.json()) as dto.ArchiveListResponse) : null;
  } catch {
    return null;
  }
}

export async function fetchArchiveSnapshot(term: string): Promise<dto.CanvasSnapshotResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/archives/${encodeURIComponent(term)}/snapshot`);
    return res.ok ? ((await res.json()) as dto.CanvasSnapshotResponse) : null;
  } catch {
    return null;
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

export async function fetchReplayMeta(term: string): Promise<dto.ReplayMetaResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/archives/${encodeURIComponent(term)}/replay`);
    return res.ok ? ((await res.json()) as dto.ReplayMetaResponse) : null;
  } catch {
    return null;
  }
}
