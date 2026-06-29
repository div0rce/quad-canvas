import { afterEach, describe, it, expect, vi } from 'vitest';
import { queueMessage, actionMessage, actOnReport, fetchReports } from './moderation-client';

afterEach(() => vi.unstubAllGlobals());

describe('queueMessage', () => {
  it('is empty on success and explains auth/permission failures', () => {
    expect(queueMessage(200)).toBe('');
    expect(queueMessage(401)).toMatch(/sign in/i);
    expect(queueMessage(403)).toMatch(/moderator access/i);
    expect(queueMessage(404)).toMatch(/no canvas/i);
    expect(queueMessage(500)).toMatch(/could not load/i);
  });
});

describe('fetchReports', () => {
  it('follows the report queue cursor until every page is loaded', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      urls.push(url);
      const second = url.includes('cursor=next%7Creport');
      return Response.json({
        data: [
          {
            id: second ? 'report-2' : 'report-1',
            targetRef: 'pixel:1,1',
            reason: 'test',
            status: 'open',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        page: { nextCursor: second ? null : 'next|report', limit: 200 },
      });
    });

    const result = await fetchReports();
    expect(result.status).toBe(200);
    expect(result.data?.data.map((report) => report.id)).toEqual(['report-1', 'report-2']);
    expect(urls).toHaveLength(2);
  });
});

describe('actOnReport', () => {
  it('reuses the same idempotency key after an ambiguous transport failure', async () => {
    const keys: string[] = [];
    let attempt = 0;
    vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
      keys.push(new Headers(init?.headers).get('idempotency-key') ?? '');
      attempt += 1;
      if (attempt === 1) throw new Error('connection reset after commit');
      return new Response(null, { status: 200 });
    });

    await expect(actOnReport('report-1', 'resolve_report')).rejects.toThrow();
    await expect(actOnReport('report-1', 'resolve_report')).resolves.toBe(200);
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBe(keys[0]);
  });
});

describe('actionMessage', () => {
  it('maps action outcomes', () => {
    expect(actionMessage(200)).toMatch(/done/i);
    expect(actionMessage(401)).toMatch(/sign in/i);
    expect(actionMessage(403)).toMatch(/moderator access/i);
    expect(actionMessage(404)).toMatch(/not found/i);
    expect(actionMessage(500)).toMatch(/failed/i);
  });
});
