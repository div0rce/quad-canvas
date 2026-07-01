// apps/api — verification email transport. The flow is identical regardless of delivery, so the
// transport is injected: dev/tests use the logger/capture below; production wires the real provider
// at the composition root. Email is DC3 — never log the full address.
import { Resend, type CreateEmailOptions, type CreateEmailResponse } from 'resend';

export interface MailTransport {
  sendVerificationLink(email: string, token: string): Promise<void>;
}

interface ResendEmailClient {
  readonly emails: {
    send(payload: CreateEmailOptions): Promise<CreateEmailResponse>;
  };
}

export interface ResendMailTransportOptions {
  readonly apiKey?: string;
  readonly baseUrl: string;
  readonly from: string;
  readonly client?: ResendEmailClient;
  readonly log?: (message: string) => void;
}

/** Mask an email to its domain for safe logging (DC3 local-part is hidden). */
function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  return at >= 0 ? `*@${email.slice(at + 1)}` : '*';
}

function verificationUrl(baseUrl: URL, token: string): string {
  const url = new URL('/signin/confirm', baseUrl);
  url.searchParams.set('token', token);
  return url.toString();
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

/** Production transport: sends a magic-link email via Resend. Requires a verified sender domain in
 *  production; `onboarding@resend.dev` should only be used for provider smoke tests. */
export class ResendMailTransport implements MailTransport {
  readonly #client: ResendEmailClient;
  readonly #baseUrl: URL;
  readonly #from: string;
  readonly #log: (message: string) => void;

  constructor(options: ResendMailTransportOptions) {
    if (!options.client && !options.apiKey) {
      throw new Error('ResendMailTransport requires either a Resend client or apiKey');
    }
    this.#client = options.client ?? new Resend(options.apiKey);
    this.#baseUrl = new URL(options.baseUrl);
    this.#from = options.from;
    this.#log = options.log ?? (() => undefined);
  }

  async sendVerificationLink(email: string, token: string): Promise<void> {
    const link = verificationUrl(this.#baseUrl, token);
    const escapedLink = escapeHtml(link);
    const { data, error } = await this.#client.emails.send({
      from: this.#from,
      to: email,
      subject: 'Sign in to Rutgers Quad',
      text: `Use this link to sign in to Rutgers Quad:\n\n${link}\n\nThis link expires soon and can only be used once.`,
      html: `<p>Use this link to sign in to Rutgers Quad:</p><p><a href="${escapedLink}">Sign in to Rutgers Quad</a></p><p>This link expires soon and can only be used once.</p>`,
      tags: [{ name: 'category', value: 'auth_verification' }],
    });

    if (error) {
      throw new Error(`Resend verification email failed: ${error.message}`);
    }
    this.#log(`verification email submitted for ${maskEmail(email)} (resend id ${data?.id ?? 'unknown'})`);
  }
}

/** Dev-only transport: logs the token + masked recipient so a developer can complete the flow with no
 *  mail provider. NEVER wire this in production — the token is a bearer credential (it alone mints a
 *  session). The composition root gates it behind an explicit opt-in (see runtime.ts). */
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

  sendVerificationLink(email: string, token: string): Promise<void> {
    void token;
    this.#log(`verification link requested for ${maskEmail(email)} (no mail provider configured; not delivered)`);
    return Promise.resolve();
  }
}
