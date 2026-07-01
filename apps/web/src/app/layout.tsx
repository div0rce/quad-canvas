import './globals.css';

import type { CSSProperties, ReactNode } from 'react';
import type { Metadata } from 'next';
import { Press_Start_2P, VT323 } from 'next/font/google';
import { resolveCurrentTenant, FALLBACK_PRIMARY } from '@/lib/tenant';
import { TenantProvider } from '@/components/tenant-provider';

// Two display faces: a pixel face for titles/numbers/wordmark, a tall monospace for
// body and data. Loaded at build time (self-hosted, no render-blocking request) and
// exposed as CSS variables that globals.css consumes.
const pixelFont = Press_Start_2P({ subsets: ['latin'], weight: '400', variable: '--font-pixel', display: 'swap' });
const monoFont = VT323({ subsets: ['latin'], weight: '400', variable: '--font-mono', display: 'swap' });

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
    <html lang="en" className={`${pixelFont.variable} ${monoFont.variable}`}>
      <body style={themeStyle}>
        <TenantProvider tenant={tenant}>{children}</TenantProvider>
      </body>
    </html>
  );
}
