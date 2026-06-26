import { describe, it, expect } from 'vitest';
import { InMemorySessionStore } from './session-store.js';
import { InMemoryVerificationStore } from './verification-store.js';
import { AuthService, type AuthRepository, type AuthTenant } from './auth-service.js';

class CaptureMail {
  readonly sent: Array<{ email: string; token: string }> = [];
  sendVerificationLink(email: string, token: string): Promise<void> {
    this.sent.push({ email, token });
    return Promise.resolve();
  }
}

class FakeRepo implements AuthRepository {
  readonly users = new Map<string, string>();
  readonly memberships: Array<{ tenantId: string; userId: string; role: string }> = [];
  #seq = 0;
  findOrCreateUserByEmail(email: string): Promise<{ id: string }> {
    let id = this.users.get(email);
    if (id === undefined) {
      this.#seq += 1;
      id = `u${this.#seq}`;
      this.users.set(email, id);
    }
    return Promise.resolve({ id });
  }
  ensureActiveMembership(tenantId: string, userId: string, role: string): Promise<void> {
    if (!this.memberships.some((m) => m.tenantId === tenantId && m.userId === userId)) {
      this.memberships.push({ tenantId, userId, role });
    }
    return Promise.resolve();
  }
  findActiveMembership(tenantId: string, userId: string): Promise<{ role: string } | null> {
    const m = this.memberships.find((x) => x.tenantId === tenantId && x.userId === userId);
    return Promise.resolve(m ? { role: m.role } : null);
  }
}

const tenant: AuthTenant = { id: 'ten_rutgers', domains: ['rutgers.edu', 'scarletmail.rutgers.edu'] };

function makeService(): { service: AuthService; mail: CaptureMail; repo: FakeRepo; sessions: InMemorySessionStore } {
  const sessions = new InMemorySessionStore();
  const mail = new CaptureMail();
  const repo = new FakeRepo();
  const service = new AuthService({
    verifications: new InMemoryVerificationStore(),
    mail,
    repo,
    sessions,
    verificationTtlSeconds: 900,
    sessionTtlSeconds: 3600,
  });
  return { service, mail, repo, sessions };
}

describe('AuthService', () => {
  it('issues a token for an allowlisted email domain', async () => {
    const { service, mail } = makeService();
    const result = await service.requestVerification('me@scarletmail.rutgers.edu', tenant);
    expect(result.ok).toBe(true);
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0]?.email).toBe('me@scarletmail.rutgers.edu');
  });

  it('rejects an email whose domain is not allowlisted', async () => {
    const { service, mail } = makeService();
    const result = await service.requestVerification('me@gmail.com', tenant);
    expect(result.ok === false && result.reason).toBe('DOMAIN_NOT_ALLOWED');
    expect(mail.sent).toHaveLength(0);
  });

  it('rejects a malformed email', async () => {
    const { service } = makeService();
    const result = await service.requestVerification('not-an-email', tenant);
    expect(result.ok === false && result.reason).toBe('INVALID_EMAIL');
  });

  it('confirms a token: creates user + participant membership + session', async () => {
    const { service, mail, repo, sessions } = makeService();
    await service.requestVerification('me@rutgers.edu', tenant);
    const token = mail.sent[0]?.token ?? '';
    const sessionId = await service.confirm(token, 'ten_rutgers');
    expect(sessionId).not.toBeNull();
    expect(await sessions.get(sessionId ?? '')).toMatchObject({ tenantId: 'ten_rutgers' });
    expect(repo.memberships).toEqual([{ tenantId: 'ten_rutgers', userId: 'u1', role: 'participant' }]);
  });

  it('rejects an invalid or reused token (single-use)', async () => {
    const { service, mail } = makeService();
    await service.requestVerification('me@rutgers.edu', tenant);
    const token = mail.sent[0]?.token ?? '';
    expect(await service.confirm(token, 'ten_rutgers')).not.toBeNull();
    expect(await service.confirm(token, 'ten_rutgers')).toBeNull();
    expect(await service.confirm('garbage', 'ten_rutgers')).toBeNull();
  });
});
