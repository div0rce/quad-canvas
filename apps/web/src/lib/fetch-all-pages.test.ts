import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAllPages } from './fetch-all-pages';

afterEach(() => vi.unstubAllGlobals());

describe('fetchAllPages', () => {
  it('fails closed when a server repeats a cursor', async () => {
    vi.stubGlobal('fetch', async () => Response.json({ data: ['item'], page: { nextCursor: 'same', limit: 1 } }));
    await expect(fetchAllPages('/items?limit=1', undefined, (value): value is string => typeof value === 'string')).resolves.toBeNull();
  });
});
