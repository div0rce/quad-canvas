'use client';

import { Fragment } from 'react';
import { AppBar } from '@/components/ui/app-bar';
import { SessionBadge } from '@/auth/session-badge';
import { useTenant } from '@/components/tenant-provider';

/**
 * Tenant marketing home — what a visitor sees before signing in. Pure presentation over the
 * resolved tenant (T8); it runs no fetches of its own. The live canvas, real per-term stats, and
 * the term name live behind their own screens/APIs, so this page never invents counts or a live
 * feed: the preview panel is decorative only. An unknown host (tenant === null) falls back to the
 * "not configured" note.
 */

// Horizontal section padding: collapses on narrow viewports without a media query.
const PAD_X = 'clamp(20px, 4vw, 32px)';

// Semester lifecycle chrome (static marketing copy — term status is a per-archive fact, not a
// landing-page field). The final stage tracks the tenant accent.
const LIFECYCLE = [
  { label: 'Upcoming', dot: 'var(--silver)', text: 'var(--muted-tag)' },
  { label: 'Active', dot: 'var(--live-green)', text: 'var(--ink)' },
  { label: 'Frozen', dot: 'var(--status-sky)', text: 'var(--muted-tag)' },
  { label: 'Archived', dot: 'var(--qa)', text: 'var(--muted-tag)' },
] as const;

// A small, fixed pixel-art motif for the decorative preview (a diamond). '.' = empty well cell,
// 'k' = ink outline, 'q' = accent, 't' = accent tint. Purely ornamental — encodes no data.
const MOTIF = ['....k....', '...kqk...', '..kqtqk..', '.kqtttqk.', '..kqtqk..', '...kqk...', '....k....'];
const MOTIF_COLOR: Record<string, string | undefined> = {
  k: 'var(--ink)',
  q: 'var(--qa)',
  t: 'var(--qa-tint)',
};

/** Presentational shell only — no business logic beyond composition (T8). */
export function AppShell(): React.ReactElement {
  const tenant = useTenant();

  if (!tenant) {
    return (
      <main className="quad-page">
        <p className="quad-board-label">Landing</p>
        <div className="quad-panel">
          <AppBar tenantLabel={null} right={<SessionBadge />} />
          <section style={{ padding: `48px ${PAD_X} 56px` }}>
            <div className="quad-card" style={{ maxWidth: 560, padding: 28 }}>
              <span className="quad-eyebrow">Not configured</span>
              <h1 className="quad-pixel" style={{ fontSize: 'clamp(18px, 3vw, 22px)', lineHeight: 1.5, color: 'var(--ink)', margin: '14px 0 0' }}>
                Unknown tenant
              </h1>
              <p style={{ fontSize: 20, lineHeight: 1.45, color: 'var(--ink-strong)', margin: '14px 0 0' }}>
                This host is not configured for any tenant. There is no default tenant — add a host in{' '}
                <code>@quad/config</code> to map it.
              </p>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="quad-page">
      <p className="quad-board-label">Landing</p>
      <div className="quad-panel">
        <AppBar
          tenantLabel={tenant.title}
          nav={[
            { label: 'Canvas', href: '/canvas' },
            { label: 'Board', href: '/leaderboards' },
            { label: 'Archive', href: '/archives' },
          ]}
          right={<SessionBadge />}
        />

        {/* ----- Hero ----- */}
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 44,
            padding: `50px ${PAD_X} 40px`,
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ marginBottom: 26 }}>
              <span className="quad-pill">
                <span className="quad-dot" style={{ background: 'var(--live-green)' }} />
                <span style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>Live now</span>
              </span>
            </div>
            <h1 className="quad-pixel" style={{ fontSize: 'clamp(22px, 3.4vw, 30px)', lineHeight: 1.55, color: 'var(--ink)', margin: 0 }}>
              One campus.
              <br />
              One pixel.
              <br />
              <span style={{ color: 'var(--qa)' }}>One semester.</span>
            </h1>
            <p style={{ fontSize: 22, lineHeight: 1.4, color: 'var(--ink-strong)', margin: '24px 0 0', maxWidth: '46ch' }}>
              Join a live, collaborative pixel canvas where communities build one shared image together in real time, one pixel
              at a time.
            </p>
            <div style={{ display: 'flex', gap: 12, marginTop: 30, flexWrap: 'wrap' }}>
              <a href="/signin" className="quad-btn quad-btn--primary quad-btn--lg">
                Sign in with email
              </a>
              <a href="/canvas" className="quad-btn quad-btn--lg">
                View the canvas
              </a>
            </div>
            <div
              style={{
                display: 'flex',
                gap: 20,
                marginTop: 24,
                flexWrap: 'wrap',
                fontSize: 18,
                color: 'var(--muted-tag)',
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
              }}
            >
              <span>+ RALLY TOGETHER</span>
              <span>+ PLACE PIXELS</span>
              <span>+ WATCH LIVE</span>
            </div>
          </div>

          {/* Decorative canvas preview — no live data, no fabricated stats. */}
          <div
            style={{
              background: 'var(--surface)',
              border: 'var(--border-structural) solid var(--ink)',
              boxShadow: 'var(--shadow-board)',
              padding: 13,
            }}
          >
            <div
              aria-hidden
              style={{
                position: 'relative',
                aspectRatio: '7 / 5',
                background: 'var(--canvas-well)',
                border: 'var(--border-component) solid var(--ink)',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundImage:
                  'linear-gradient(var(--rail) 1px, transparent 1px), linear-gradient(90deg, var(--rail) 1px, transparent 1px)',
                backgroundSize: '14px 14px',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${MOTIF[0]?.length ?? 0}, 14px)`,
                  gridAutoRows: '14px',
                }}
              >
                {MOTIF.flatMap((row, y) =>
                  [...row].map((ch, x) => <span key={`${x}-${y}`} style={{ background: MOTIF_COLOR[ch] ?? 'transparent' }} />),
                )}
              </div>
              <div className="quad-hud" style={{ top: 11, left: 11 }}>
                <span className="quad-dot quad-blink" style={{ background: 'var(--live-red)' }} />
                <span>LIVE</span>
              </div>
            </div>
          </div>
        </section>

        {/* ----- Feature cards ----- */}
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 18,
            padding: `6px ${PAD_X} 28px`,
          }}
        >
          <article className="quad-card" style={{ padding: 22 }}>
            <div
              aria-hidden
              style={{
                width: 36,
                height: 36,
                background: 'var(--qa-tint)',
                border: 'var(--border-component) solid var(--ink)',
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 7px)',
                gridTemplateRows: 'repeat(2, 7px)',
                gap: 2,
                placeContent: 'center',
              }}
            >
              <i style={{ background: 'var(--qa)' }} />
              <i style={{ background: 'var(--qa)' }} />
              <i style={{ background: 'var(--qa)' }} />
              <i style={{ background: 'var(--qa)' }} />
            </div>
            <h2 className="quad-pixel" style={{ fontSize: 15, color: 'var(--ink)', margin: '16px 0 0' }}>
              Equal power
            </h2>
            <p style={{ fontSize: 20, lineHeight: 1.45, color: 'var(--ink-strong)', margin: '9px 0 0' }}>
              Every student gets the same shot: one pixel per cooldown. The canvas belongs to the collaborative that can
              organize, coordinate, and out-chaos the rest.
            </p>
          </article>

          <article className="quad-card" style={{ padding: 22 }}>
            <div
              aria-hidden
              style={{
                width: 36,
                height: 36,
                background: 'var(--qa-tint)',
                border: 'var(--border-component) solid var(--ink)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ width: 10, height: 10, background: 'var(--qa)', animation: 'qblink 1.1s steps(1, end) infinite' }} />
            </div>
            <h2 className="quad-pixel" style={{ fontSize: 15, color: 'var(--ink)', margin: '16px 0 0' }}>
              Always alive
            </h2>
            <p style={{ fontSize: 20, lineHeight: 1.45, color: 'var(--ink-strong)', margin: '9px 0 0' }}>
              Every pixel appears the moment it’s placed, keeping everyone synced on the same shared image in real time.
            </p>
          </article>

          <article className="quad-card" style={{ padding: 22 }}>
            <div
              aria-hidden
              style={{
                width: 36,
                height: 36,
                background: 'var(--qa-tint)',
                border: 'var(--border-component) solid var(--ink)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ width: 16, height: 13, border: '3px solid var(--qa)' }} />
            </div>
            <h2 className="quad-pixel" style={{ fontSize: 15, color: 'var(--ink)', margin: '16px 0 0' }}>
              Saved forever
            </h2>
            <p style={{ fontSize: 20, lineHeight: 1.45, color: 'var(--ink-strong)', margin: '9px 0 0' }}>
              At term end the canvas freezes, gets archived forever, and becomes a replay you can scrub from blank to finished.
            </p>
          </article>
        </section>

        {/* ----- Semester lifecycle stepper ----- */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 0,
            padding: `20px ${PAD_X} 36px`,
            borderTop: 'var(--border-structural) solid var(--ink)',
            background: 'var(--surface)',
            flexWrap: 'wrap',
          }}
        >
          <span className="quad-eyebrow" style={{ marginRight: 22 }}>
            Semester lifecycle
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 280 }}>
            {LIFECYCLE.map((stage, i) => (
              <Fragment key={stage.label}>
                {i > 0 ? <span aria-hidden style={{ height: 3, flex: 1, minWidth: 16, background: 'var(--rail)' }} /> : null}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span aria-hidden style={{ width: 10, height: 10, background: stage.dot }} />
                  <span style={{ fontSize: 20, color: stage.text, textTransform: 'uppercase' }}>{stage.label}</span>
                </span>
              </Fragment>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
