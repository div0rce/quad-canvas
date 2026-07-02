// apps/web — the one primary nav, identical on every screen: Canvas · Guilds · Leaderboard ·
// Archive. Home is not a nav item; the brand mark (logo/wordmark) is the way home.
import type { NavItem } from '@/components/ui/app-bar';

export type MainNavKey = 'canvas' | 'guilds' | 'leaderboard' | 'archive';

export function mainNav(active?: MainNavKey): NavItem[] {
  return [
    { label: 'Canvas', href: '/canvas', active: active === 'canvas' },
    { label: 'Guilds', href: '/guilds', active: active === 'guilds' },
    { label: 'Leaderboard', href: '/leaderboards', active: active === 'leaderboard' },
    { label: 'Archive', href: '/archives', active: active === 'archive' },
  ];
}
