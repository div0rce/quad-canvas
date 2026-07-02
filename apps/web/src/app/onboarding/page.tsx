'use client';

// apps/web — first-run onboarding. A short flow that sets the member's public handle (required to be
// visible), an optional display name, and optionally joins a guild, then explains placement. New
// members have no handle until this runs. Member-gated.
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { dto } from '@quad/core';
import { fetchSession } from '@/auth/auth-client';
import { handleValidationError, updateProfile } from '@/onboarding/onboarding-client';
import { fetchGuilds, joinGuild } from '@/guilds/guilds-client';
import { useTenant } from '@/components/tenant-provider';

const TOTAL_STEPS = 6;

export default function OnboardingPage(): React.ReactElement {
  const router = useRouter();
  const tenant = useTenant();
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState(0);
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [guilds, setGuilds] = useState<readonly dto.GuildSummary[]>([]);
  const [joined, setJoined] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;
    void fetchSession().then((s) => {
      if (!active) return;
      if (!s.authenticated) router.replace('/');
      else setReady(true);
    });
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (step !== 3 || guilds.length > 0) return;
    void fetchGuilds().then(setGuilds);
  }, [step, guilds.length]);

  const go = (n: number): void => {
    setError('');
    setStep(n);
  };

  const saveHandle = useCallback(async () => {
    const invalid = handleValidationError(handle);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError('');
    const res = await updateProfile({ handle: handle.trim().replace(/^@/, '') });
    setBusy(false);
    if (res.ok) go(2);
    else setError(res.error ?? 'Could not save your username.');
  }, [handle]);

  const saveDisplayName = useCallback(async () => {
    setBusy(true);
    setError('');
    if (displayName.trim() !== '') await updateProfile({ displayName });
    setBusy(false);
    go(3);
  }, [displayName]);

  const onJoin = useCallback(async (slug: string) => {
    if (await joinGuild(slug)) setJoined((j) => ({ ...j, [slug]: true }));
  }, []);

  const liveHandleError = handle.trim() !== '' ? handleValidationError(handle) : null;

  return (
    <main className="quad-page">
      <div className="quad-panel quad-onb">
        <header className="quad-onb__top">
          <span className="quad-wordmark">Quad</span>
          <span className="quad-onb__progress">
            Step {Math.min(step + 1, TOTAL_STEPS)} of {TOTAL_STEPS}
          </span>
        </header>

        {!ready ? (
          <p className="quad-friends__note" role="status">
            Loading…
          </p>
        ) : (
          <div className="quad-onb__card quad-card">
            {step === 0 ? (
              <>
                <h1 className="quad-pixel">Welcome to Quad</h1>
                <p className="quad-onb__lead">
                  {tenant?.title ?? 'Quad'} is a campus pixel arena. Place pixels, join a guild, and leave a mark on the archive.
                </p>
                <button type="button" className="quad-btn quad-btn--primary quad-btn--lg" onClick={() => go(1)}>
                  Start
                </button>
              </>
            ) : null}

            {step === 1 ? (
              <>
                <h1 className="quad-pixel">Pick your username</h1>
                <p className="quad-onb__lead">This is your public Quad identity. Don’t include @; we never show your email.</p>
                <div className="quad-onb__handle">
                  <span aria-hidden>@</span>
                  <input
                    className="quad-friends__search"
                    aria-label="Username"
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    autoComplete="off"
                    autoFocus
                  />
                </div>
                <p className="quad-onb__hint">{liveHandleError ?? '3–24 characters: letters, numbers, underscores, or hyphens.'}</p>
                {error ? (
                  <p className="quad-guild__error" role="alert">
                    {error}
                  </p>
                ) : null}
                <div className="quad-onb__actions">
                  <button type="button" className="quad-btn" onClick={() => go(0)}>
                    Back
                  </button>
                  <button type="button" className="quad-btn quad-btn--primary" disabled={busy || liveHandleError !== null || handle.trim() === ''} onClick={() => void saveHandle()}>
                    {busy ? 'Saving…' : 'Continue'}
                  </button>
                </div>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <h1 className="quad-pixel">Add a display name</h1>
                <p className="quad-onb__lead">Optional — a friendlier name shown next to your @handle.</p>
                <input
                  className="quad-friends__search"
                  aria-label="Display name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={48}
                  autoComplete="off"
                />
                <div className="quad-onb__actions">
                  <button type="button" className="quad-btn" onClick={() => go(1)}>
                    Back
                  </button>
                  <button type="button" className="quad-btn quad-btn--primary" disabled={busy} onClick={() => void saveDisplayName()}>
                    {busy ? 'Saving…' : 'Continue'}
                  </button>
                  <button type="button" className="quad-onb__skip" onClick={() => go(3)}>
                    Skip
                  </button>
                </div>
              </>
            ) : null}

            {step === 3 ? (
              <>
                <h1 className="quad-pixel">Join a guild</h1>
                <p className="quad-onb__lead">Guilds are social teams — a flag to fly. Purely cosmetic; your pixel is still yours.</p>
                <ul className="quad-friends__list">
                  {guilds.length === 0 ? (
                    <li className="quad-friends__empty">
                      No guilds yet. <Link href="/guilds/new">Create one</Link> later, or skip for now.
                    </li>
                  ) : (
                    guilds.slice(0, 6).map((g) => (
                      <li key={g.slug} className="quad-friends__row">
                        <span className="quad-friends__row-main">
                          {g.name}
                          <span className="quad-friends__display">
                            {g.memberCount} {g.memberCount === 1 ? 'member' : 'members'}
                          </span>
                        </span>
                        <button
                          type="button"
                          className={joined[g.slug] || g.joined ? 'quad-btn' : 'quad-btn quad-btn--primary'}
                          disabled={joined[g.slug] || g.joined}
                          onClick={() => void onJoin(g.slug)}
                        >
                          {joined[g.slug] || g.joined ? 'Joined' : 'Join'}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
                <div className="quad-onb__actions">
                  <button type="button" className="quad-btn" onClick={() => go(2)}>
                    Back
                  </button>
                  <button type="button" className="quad-btn quad-btn--primary" onClick={() => go(4)}>
                    Continue
                  </button>
                </div>
              </>
            ) : null}

            {step === 4 ? (
              <>
                <h1 className="quad-pixel">How placing works</h1>
                <ol className="quad-onb__steps">
                  <li>Select a pixel.</li>
                  <li>Pick a color.</li>
                  <li>Place it.</li>
                  <li>Wait out the cooldown — the same for everyone on campus.</li>
                </ol>
                <div className="quad-onb__actions">
                  <button type="button" className="quad-btn" onClick={() => go(3)}>
                    Back
                  </button>
                  <button type="button" className="quad-btn quad-btn--primary" onClick={() => go(5)}>
                    Got it
                  </button>
                </div>
              </>
            ) : null}

            {step === 5 ? (
              <>
                <h1 className="quad-pixel">You’re ready.</h1>
                <p className="quad-onb__lead">Your account is set up and your first pixel is waiting.</p>
                <div className="quad-onb__actions">
                  <Link className="quad-btn quad-btn--primary quad-btn--lg" href="/home">
                    Go to home
                  </Link>
                  <Link className="quad-btn" href="/canvas">
                    Enter the canvas
                  </Link>
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}
