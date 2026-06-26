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

/** Dev transport: logs the token + masked recipient so a developer can complete the flow locally. */
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
