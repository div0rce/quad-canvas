// @quad/core — tenant config contract (T4 skeleton). Tenant-neutral; NO tenant literal here.
// The tenant registry (Rutgers = tenant #1) lives in @quad/config, never in platform code.
import type { TenantId } from '../domain/ids.js';

export type TenantStatus = 'pending' | 'active' | 'suspended' | 'archived';

export type AuthProviderKind = 'email-verification' | 'sso';

export interface AuthProviderConfig {
  readonly type: AuthProviderKind;
  /** SSO/IdP identifier when type === 'sso'. */
  readonly idp?: string;
}

export type TermCadence = 'semester' | 'quarter' | 'trimester';

export interface FeatureFlags {
  readonly readOnlyViewing?: boolean;
  readonly archiveVisibility?: 'public' | 'members';
}

export interface ThemeTokens {
  readonly primary?: string;
  readonly logo?: string;
}

/** Per-tenant configuration shape consumed from @quad/config (no tenant hardcoded in platform code). */
export interface TenantConfig {
  readonly id: TenantId;
  readonly slug: string;
  readonly publicTitle: string;
  readonly hosts: readonly string[];
  readonly domains: readonly string[];
  readonly authProvider: AuthProviderConfig;
  readonly theme: ThemeTokens;
  readonly palette: string;
  readonly featureFlags: FeatureFlags;
  readonly termCadence: TermCadence;
  readonly status: TenantStatus;
}
