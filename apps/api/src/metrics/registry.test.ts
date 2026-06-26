import { describe, it, expect } from 'vitest';
import { MetricsRegistry } from './registry.js';

describe('MetricsRegistry', () => {
  it('counts by method/route/status and renders Prometheus text', () => {
    const m = new MetricsRegistry();
    m.increment('GET', '/api/v1/profiles/:handle', 200);
    m.increment('GET', '/api/v1/profiles/:handle', 200);
    m.increment('POST', '/api/v1/reports', 201);
    const out = m.render();
    expect(out).toContain('# TYPE http_requests_total counter');
    expect(out).toContain('http_requests_total{method="GET",route="/api/v1/profiles/:handle",status="200"} 2');
    expect(out).toContain('http_requests_total{method="POST",route="/api/v1/reports",status="201"} 1');
  });

  it('escapes quotes and backslashes in label values', () => {
    const m = new MetricsRegistry();
    m.increment('GET', '/a"b\\c', 200);
    expect(m.render()).toContain('route="/a\\"b\\\\c"');
  });
});
