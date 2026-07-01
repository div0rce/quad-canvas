import { AppShell } from '@/components/app-shell';
import { SignedInRedirect } from '@/components/signed-in-redirect';

// The root route. Signed-out visitors get the tenant marketing landing; signed-in members are sent
// to their dashboard (/home). Tenant is resolved server-side by the layout.
export default function Page(): React.ReactElement {
  return (
    <>
      <SignedInRedirect to="/home" />
      <AppShell />
    </>
  );
}
