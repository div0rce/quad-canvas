import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';

// Name of the opaque, httpOnly session cookie the API sets on sign-in. Must stay in step with the
// API's SESSION_COOKIE (apps/api/src/plugins/identity.ts); the two apps share no auth module.
const SESSION_COOKIE = 'quad_session';

// Root route. A signed-in visitor goes straight to the live canvas; everyone else lands on the
// marketing home. The decision reads the session cookie's presence — a value the browser only holds
// while a session is live (it carries a TTL and is cleared on sign-out). Reading a cookie also opts
// this route out of static generation, so the branch is evaluated per request. Presence, rather than
// an authoritative /session round-trip, is deliberate: it fails safe — a signed-in user can never
// wrongly see the landing page, and a stale cookie only sends someone to the canvas, which is
// publicly viewable anyway.
export default async function Page(): Promise<React.ReactElement> {
  const cookieStore = await cookies();
  if (cookieStore.has(SESSION_COOKIE)) {
    redirect('/canvas');
  }
  return <AppShell />;
}
