import type { dto } from '@quad/core';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function appendCursor(url: string, cursor: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}cursor=${encodeURIComponent(cursor)}`;
}

/** Fetch a complete cursor-paginated collection, failing instead of returning a misleading prefix. */
export async function fetchAllPages<T>(
  initialUrl: string,
  init: RequestInit | undefined,
  isItem: (value: unknown) => value is T,
  initialResponse?: Response,
): Promise<dto.Paginated<T> | null> {
  const data: T[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | null = null;
  let limit = 0;
  let firstResponse = initialResponse;

  do {
    const res = firstResponse ?? (await fetch(cursor === null ? initialUrl : appendCursor(initialUrl, cursor), init));
    firstResponse = undefined;
    if (!res.ok) return null;
    const body = (await res.json()) as unknown;
    if (!isRecord(body) || !Array.isArray(body['data']) || !body['data'].every(isItem) || !isRecord(body['page'])) return null;
    const nextCursor = body['page']['nextCursor'];
    const pageLimit = body['page']['limit'];
    if ((nextCursor !== null && typeof nextCursor !== 'string') || !Number.isInteger(pageLimit) || Number(pageLimit) < 1) return null;
    data.push(...body['data']);
    limit = Number(pageLimit);
    if (nextCursor !== null) {
      if (seenCursors.has(nextCursor)) return null;
      seenCursors.add(nextCursor);
    }
    cursor = nextCursor;
  } while (cursor !== null);

  return { data, page: { nextCursor: null, limit } };
}
