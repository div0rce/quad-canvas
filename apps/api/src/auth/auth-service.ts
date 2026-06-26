// apps/api — verification + session issuance (the auth front-door). The magic-link flow:
//   request → validate email domain against the tenant allowlist (AUTH-INV-4) → single-use token →
//   confirm (bound to the resolved tenant) → find/create user + participant membership → issue
//   session, but only if the membership is ACTIVE (a suspended/banned email never gets a session).
// All collaborators are injected, so the logic is unit-testable and tenant-neutral.
import type { SessionStore } from './session-store.js';
import { newVerificationToken, type VerificationStore } from './verification-store.js';
import type { MailTransport } from './mail.js';

export interface AuthRepository {
  findOrCreateUserByEmail(email: string): Promise<{ id: string }>;
  ensureActiveMembership(tenantId: string, userId: string, role: string): Promise<void>;
  findActiveMembership(tenantId: string, userId: string): Promise<{ role: string } | null>;
}

export interface AuthTenant {
  readonly id: string;
  readonly domains: readonly string[];
}

export interface AuthServiceDeps {
  readonly verifications: VerificationStore;
  readonly mail: MailTransport;
  readonly repo: AuthRepository;
  readonly sessions: SessionStore;
  readonly verificationTtlSeconds: number;
  readonly sessionTtlSeconds: number;
  /** Injectable token generator (tests). */
  readonly newToken?: () => string;
}

export type RequestVerificationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'INVALID_EMAIL' | 'DOMAIN_NOT_ALLOWED' };

/** Canonicalize an email so case/whitespace variants map to one account. */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function emailDomain(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at <= 0 || at === email.length - 1) return null;
  return email.slice(at + 1);
}

export class AuthService {
  readonly #deps: AuthServiceDeps;

  constructor(deps: AuthServiceDeps) {
    this.#deps = deps;
  }

  /** Validate the email domain against the tenant allowlist, then issue + send a single-use token. */
  async requestVerification(rawEmail: string, tenant: AuthTenant): Promise<RequestVerificationResult> {
    const email = normalizeEmail(rawEmail);
    const domain = emailDomain(email);
    if (domain === null) return { ok: false, reason: 'INVALID_EMAIL' };
    const allowed = tenant.domains.some((d) => d.toLowerCase() === domain);
    if (!allowed) return { ok: false, reason: 'DOMAIN_NOT_ALLOWED' };

    const token = (this.#deps.newToken ?? newVerificationToken)();
    await this.#deps.verifications.create({ email, tenantId: tenant.id }, token, this.#deps.verificationTtlSeconds);
    await this.#deps.mail.sendVerificationLink(email, token);
    return { ok: true };
  }

  /**
   * Confirm a token for the resolved tenant: ensure the user + participant membership, then issue a
   * session — unless the token belongs to a different tenant or the membership is not active. Returns
   * the session id, or null.
   */
  async confirm(token: string, expectedTenantId: string): Promise<string | null> {
    const pending = await this.#deps.verifications.consume(token);
    if (!pending) return null;
    if (pending.tenantId !== expectedTenantId) return null; // token bound to another tenant
    const user = await this.#deps.repo.findOrCreateUserByEmail(pending.email);
    await this.#deps.repo.ensureActiveMembership(pending.tenantId, user.id, 'participant');
    // Never hand out a session to a suspended/banned member (ensure* leaves an existing one as-is).
    const membership = await this.#deps.repo.findActiveMembership(pending.tenantId, user.id);
    if (!membership) return null;
    return this.#deps.sessions.create({ userId: user.id, tenantId: pending.tenantId }, this.#deps.sessionTtlSeconds);
  }
}
