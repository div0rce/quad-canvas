'use client';

// apps/web — the signed-in user chip + account menu. The chip shows the public @handle (never the
// email) and an avatar initial; activating it opens a WAI-ARIA menu-button dropdown. Keyboard: the
// chip opens on Enter / Space / Arrow keys; the open menu roves focus with Up/Down (Home/End),
// closes on Escape (focus returns to the chip) or an outside click, and Tab exits naturally.
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export interface UserMenuItem {
  readonly key: string;
  readonly label: string;
  /** Navigation target (a link item). */
  readonly href?: string;
  /** Action to run (a button item), e.g. sign out. */
  readonly action?: () => void;
  /** Render a separator above this item. */
  readonly separated?: boolean;
  /** Style as a destructive/secondary action. */
  readonly destructive?: boolean;
}

/** The account-menu items for a signed-in chip. Pure, so the composition is unit-tested. Friends /
 *  add-friends items are added once those surfaces exist. */
export function userMenuItems(profileHref: string, onSignOut: () => void): readonly UserMenuItem[] {
  return [
    { key: 'profile', label: 'View profile', href: profileHref },
    { key: 'settings', label: 'Edit profile', href: '/settings' },
    { key: 'friends', label: 'Friends', href: '/friends' },
    { key: 'add-friends', label: 'Add friends', href: '/friends/add' },
    { key: 'guilds', label: 'Guilds', href: '/guilds' },
    { key: 'signout', label: 'Sign out', action: onSignOut, separated: true, destructive: true },
  ];
}

/** The next focus index for a roving-focus menu, wrapping at both ends. */
export function nextMenuIndex(current: number, delta: number, count: number): number {
  if (count === 0) return 0;
  return (current + delta + count) % count;
}

function handleInitial(handle: string): string {
  return (handle.replace(/^@/, '')[0] ?? '?').toUpperCase();
}

export function UserMenu({
  handle,
  role,
  profileHref,
  onSignOut,
}: {
  readonly handle: string;
  readonly role?: string;
  readonly profileHref: string;
  readonly onSignOut: () => void;
}): React.ReactElement {
  const router = useRouter();
  const items = userMenuItems(profileHref, onSignOut);
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const chipRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) chipRef.current?.focus();
  }, []);

  const openAt = useCallback((index: number) => {
    setFocusIndex(index);
    setOpen(true);
  }, []);

  // Move focus to the active item whenever the menu opens or the focused index changes.
  useEffect(() => {
    if (open) itemRefs.current[focusIndex]?.focus();
  }, [open, focusIndex]);

  // Close on an outside pointer-down (the menu owns clicks within its own subtree).
  useEffect(() => {
    if (!open) return undefined;
    const onDocPointer = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDocPointer);
    return () => document.removeEventListener('pointerdown', onDocPointer);
  }, [open]);

  const activate = useCallback(
    (item: UserMenuItem) => {
      close(false);
      if (item.action) item.action();
      else if (item.href) router.push(item.href);
    },
    [close, router],
  );

  const onChipKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openAt(0);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        openAt(items.length - 1);
      }
    },
    [items.length, openAt],
  );

  const onMenuKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setFocusIndex((i) => nextMenuIndex(i, 1, items.length));
          break;
        case 'ArrowUp':
          event.preventDefault();
          setFocusIndex((i) => nextMenuIndex(i, -1, items.length));
          break;
        case 'Home':
          event.preventDefault();
          setFocusIndex(0);
          break;
        case 'End':
          event.preventDefault();
          setFocusIndex(items.length - 1);
          break;
        case 'Escape':
          event.preventDefault();
          close(true);
          break;
        case 'Tab':
          close(false); // let Tab move focus onward naturally
          break;
        default:
          break;
      }
    },
    [close, items.length],
  );

  const label = handle ? `@${handle.replace(/^@/, '')}` : 'Signed in';

  return (
    <div className="quad-usermenu" ref={rootRef}>
      <button
        type="button"
        ref={chipRef}
        className="quad-chip quad-usermenu__chip"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        title={role ? `Signed in (${role})` : 'Signed in'}
        onClick={() => (open ? close(false) : openAt(0))}
        onKeyDown={onChipKeyDown}
      >
        <span className="quad-usermenu__handle">{label}</span>
        <span className="quad-avatar" style={{ width: 26, height: 26, fontSize: 11 }} aria-hidden>
          {handleInitial(handle)}
        </span>
        <span className="quad-usermenu__caret" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <div id={menuId} role="menu" aria-label="Account" className="quad-menu" onKeyDown={onMenuKeyDown}>
          {items.map((item, index) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              tabIndex={index === focusIndex ? 0 : -1}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              className={
                'quad-menu__item' +
                (item.separated ? ' quad-menu__item--separated' : '') +
                (item.destructive ? ' quad-menu__item--destructive' : '')
              }
              onClick={() => activate(item)}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
