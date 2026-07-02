import { describe, expect, it } from 'vitest';
import { nextMenuIndex, userMenuItems } from './user-menu';

describe('userMenuItems', () => {
  it('offers profile, friends, add-friends, then a separated destructive sign-out', () => {
    const onSignOut = (): void => undefined;
    const items = userMenuItems('/profiles/mira7', onSignOut);

    expect(items.map((i) => i.key)).toEqual(['profile', 'friends', 'add-friends', 'guilds', 'signout']);
    expect(items[0]).toMatchObject({ label: 'View profile', href: '/profiles/mira7' });
    expect(items[1]).toMatchObject({ label: 'Friends', href: '/friends' });
    expect(items[2]).toMatchObject({ label: 'Add friends', href: '/friends/add' });
    expect(items[3]).toMatchObject({ label: 'Guilds', href: '/guilds' });
    const signout = items.at(-1);
    expect(signout).toMatchObject({ label: 'Sign out', separated: true, destructive: true });
    expect(signout?.action).toBe(onSignOut);
  });
});

describe('nextMenuIndex', () => {
  it('wraps at both ends and is a no-op for an empty menu', () => {
    expect(nextMenuIndex(0, 1, 3)).toBe(1);
    expect(nextMenuIndex(2, 1, 3)).toBe(0); // wrap past the end
    expect(nextMenuIndex(0, -1, 3)).toBe(2); // wrap before the start
    expect(nextMenuIndex(0, 1, 0)).toBe(0); // no items
  });
});
