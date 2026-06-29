import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppShell } from './app-shell';
import { TenantProvider } from './tenant-provider';

describe('AppShell', () => {
  it('links a configured tenant landing page to the implemented product surfaces', () => {
    const html = renderToStaticMarkup(
      <TenantProvider tenant={{ slug: 'example', title: 'Example Quad', themePrimary: '#123456', palette: 'default' }}>
        <AppShell />
      </TenantProvider>,
    );

    expect(html).toContain('Example Quad');
    expect(html).toContain('href="/canvas"');
    expect(html).toContain('href="/leaderboards"');
    expect(html).toContain('href="/archives"');
    expect(html).toContain('href="/signin"');
    expect(html).not.toContain('not wired up yet');
  });

  it('keeps an unknown host tenant-neutral', () => {
    const html = renderToStaticMarkup(
      <TenantProvider tenant={null}>
        <AppShell />
      </TenantProvider>,
    );

    expect(html).toContain('Unknown tenant');
    expect(html).toContain('There is no default tenant');
    expect(html).not.toContain('href="/canvas"');
  });
});
