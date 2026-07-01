import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { profileHrefForSession, SessionBadgeView } from './session-badge';

describe('SessionBadgeView', () => {
  it('renders sign in for an anonymous session', () => {
    const html = renderToStaticMarkup(<SessionBadgeView session={{ authenticated: false }} />);

    expect(html).toContain('href="/signin"');
    expect(html).toContain('Sign in');
  });

  it('maps an authenticated session to its public profile href', () => {
    const session = { authenticated: true, handle: '@scarlet_knight', role: 'participant' } as const;

    expect(profileHrefForSession(session)).toBe('/profiles/scarlet_knight');
  });

  it('falls back to /profiles/me when the handle is unknown', () => {
    expect(profileHrefForSession({ authenticated: true })).toBe('/profiles/me');
  });
});
