import type { ReactNode } from 'react';
import Link from 'next/link';
import { PixelLogo } from './pixel-logo';

export interface NavItem {
  readonly label: string;
  readonly href: string;
  readonly active?: boolean;
}

/**
 * Top chrome shared by every screen: the pixel mark + wordmark, an optional tenant
 * label, an optional primary nav grouped with the brand, and a free right slot
 * (user chip, status pills, sign-in button, …). A dark variant is used by the
 * moderation console.
 */
export function AppBar({
  variant = 'light',
  tenantLabel,
  nav,
  right,
  logoSize = 8,
}: {
  readonly variant?: 'light' | 'dark';
  readonly tenantLabel?: string | null;
  readonly nav?: readonly NavItem[];
  readonly right?: ReactNode;
  readonly logoSize?: number;
}): React.ReactElement {
  const schoolLabel = tenantLabel?.replace(/\s+Quad$/i, '');

  return (
    <header className={variant === 'dark' ? 'quad-appbar quad-appbar--dark' : 'quad-appbar'}>
      <div className="quad-appbar__left">
        <div className="quad-appbar__brand">
          <Link href="/" className="quad-appbar__home" aria-label="Quad — home">
            <PixelLogo size={logoSize} />
            <span className="quad-wordmark">Quad</span>
          </Link>
          {schoolLabel ? (
            <span className="quad-appbar__tenant" title={tenantLabel ?? undefined}>
              {schoolLabel}
            </span>
          ) : null}
        </div>
        {nav && nav.length > 0 ? (
          <nav className="quad-nav">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={item.active ? 'page' : undefined}
                className={item.active ? 'quad-navlink quad-navlink--active' : 'quad-navlink'}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>
      {right ? <div className="quad-appbar__right">{right}</div> : null}
    </header>
  );
}
