import './globals.css';

import type { CSSProperties, ReactNode } from 'react';
import type { Metadata } from 'next';
import { resolveCurrentTenant, FALLBACK_PRIMARY } from '@/lib/tenant';
import { TenantProvider } from '@/components/tenant-provider';

export const metadata: Metadata = {
  title: 'Quad',
  description: 'Quad — a multi-tenant collaborative pixel canvas.',
};

export default async function RootLayout({ children }: { readonly children: ReactNode }) {
  // Tenant is resolved on the SERVER; only the DC2-safe PublicTenant crosses into the client.
  const tenant = await resolveCurrentTenant();
  const themeStyle = {
    '--tenant-primary': tenant?.themePrimary ?? FALLBACK_PRIMARY,
  } as CSSProperties;

  return (
    <html lang="en">
      <body style={themeStyle}>
        <TenantProvider tenant={tenant}>{children}</TenantProvider>
      </body>
    </html>
  );
}
