// apps/api — verification email transport. The flow is identical regardless of delivery, so the
// transport is injected: dev/tests use the logger/capture below; production wires the real provider
// (B6 / SMTP) at the composition root. Email is DC3 — never log the full address.
export interface MailTransport {
  sendVerificationLink(email: string, token: string): Promise<void>;
}

/** Mask an email to its domain for safe logging (DC3 local-part is hidden). */
function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  return at >= 0 ? `*@${email.slice(at + 1)}` : '*';
}

/** Dev-only transport: logs the token + masked recipient so a developer can complete the flow with no
 *  mail provider. NEVER wire this in production — the token is a bearer credential (it alone mints a
 *  session). The composition root gates it behind an explicit opt-in (see index.ts). */
export class LogMailTransport implements MailTransport {
  readonly #log: (message: string) => void;

  constructor(log: (message: string) => void = () => undefined) {
    this.#log = log;
  }

  sendVerificationLink(email: string, token: string): Promise<void> {
    this.#log(`verification link issued for ${maskEmail(email)} (token ${token})`);
    return Promise.resolve();
  }
}

/** Safe default when no real provider is configured: records that a link was requested (masked
 *  recipient only) WITHOUT ever logging the token. The link is not delivered; this avoids leaking a
 *  session-granting credential to logs in production. Wire a real provider for actual delivery. */
export class NullMailTransport implements MailTransport {
  readonly #log: (message: string) => void;

  constructor(log: (message: string) => void = () => undefined) {
    this.#log = log;
  }

  sendVerificationLink(email: string, _token: string): Promise<void> {
    this.#log(`verification link requested for ${maskEmail(email)} (no mail provider configured; not delivered)`);
    return Promise.resolve();
  }
}
