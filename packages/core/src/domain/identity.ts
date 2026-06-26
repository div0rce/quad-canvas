// @quad/core — identity contracts (T4 skeleton). Pure types.
import type { TenantId, UserId } from './ids.js';

/** Tenant-defined public handle (e.g., a NetID-style handle). DC2 — safe to show publicly. */
export type PublicHandle = string;
/** Optional chosen display name. DC2 — safe to show publicly. */
export type DisplayName = string;

/** DC2: the ONLY identity ever exposed publicly (attribution, profiles, leaderboards, replay). */
export interface PublicIdentity {
  readonly handle: PublicHandle;
  readonly displayName?: DisplayName;
}

/**
 * DC3: private account identity. NEVER serialized into a public/participant DTO, WS payload, or log.
 * Authorized (self / moderator / operator) access only.
 */
export interface AccountIdentity {
  readonly id: UserId;
  /** University email (DC3) — minimized; never public. */
  readonly email: string;
  readonly verifiedAt?: string;
}

/** Tenant-scoped role (operator is platform-level / cross-tenant). */
export type Role = 'participant' | 'moderator' | 'admin' | 'operator';

export type MembershipStatus = 'active' | 'suspended' | 'banned';

/** Binds a user to a tenant with a role (tenant-scoped). */
export interface Membership {
  readonly userId: UserId;
  readonly tenantId: TenantId;
  readonly role: Role;
  readonly status: MembershipStatus;
}

/**
 * A verified, tenant-scoped actor authorized to issue commands. Resolved at the auth boundary
 * (the session mechanism is owned by AUTHENTICATION.md / ADR-0006) and passed INTO domain
 * services, which never trust client-supplied identity claims (`BE-INV-6`, `PRIN-NO-ANON`).
 */
export interface Principal {
  readonly userId: UserId;
  readonly tenantId: TenantId;
  readonly role: Role;
}
