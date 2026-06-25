'use client';

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { PublicTenant } from '@/lib/tenant';

// PublicTenant is imported type-only, so no server module (next/headers) reaches the client bundle.
const TenantContext = createContext<PublicTenant | null>(null);

export function TenantProvider({
  tenant,
  children,
}: {
  readonly tenant: PublicTenant | null;
  readonly children: ReactNode;
}) {
  return <TenantContext.Provider value={tenant}>{children}</TenantContext.Provider>;
}

/** Read the resolved tenant (DC2-safe) from context; null when the host is unknown. */
export function useTenant(): PublicTenant | null {
  return useContext(TenantContext);
}
