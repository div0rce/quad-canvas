import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { profileHrefForSession, SessionBadgeView } from './session-badge';

describe('SessionBadgeView', () => {
  it('renders sign in for an anonymous session', () => {
    const html = renderToStaticMarkup(<SessionBadgeView session={{ authenticated: false }} />);

    expect(html).toContain('href="/signin"');
    expect(html).toContain('Sign in');
  });

  it('turns the sign-in action into a profile link for an authenticated session', () => {
    const session = { authenticated: true, handle: '@scarlet_knight', role: 'participant' } as const;
    const html = renderToStaticMarkup(<SessionBadgeView session={session} />);

    expect(profileHrefForSession(session)).toBe('/profiles/scarlet_knight');
    expect(html).toContain('href="/profiles/scarlet_knight"');
    expect(html).toContain('Profile');
    expect(html).toContain('@scarlet_knight');
    expect(html).not.toContain('href="/signin"');
  });
});
