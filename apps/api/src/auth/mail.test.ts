import { describe, expect, it } from 'vitest';
import type { CreateEmailOptions, CreateEmailResponse } from 'resend';
import { LogMailTransport, NullMailTransport, ResendMailTransport } from './mail.js';

class FakeResendClient {
  readonly sent: CreateEmailOptions[] = [];
  response: CreateEmailResponse = { data: { id: 'email_123' }, error: null, headers: null };

  readonly emails = {
    send: (payload: CreateEmailOptions): Promise<CreateEmailResponse> => {
      this.sent.push(payload);
      return Promise.resolve(this.response);
    },
  };
}

describe('mail transports', () => {
  it('sends verification links through Resend using the configured web base URL', async () => {
    const client = new FakeResendClient();
    const logs: string[] = [];
    const mail = new ResendMailTransport({
      client,
      baseUrl: 'https://quad-canvas-web-test.vercel.app/',
      from: 'Rutgers Quad <auth@example.edu>',
      log: (m) => logs.push(m),
    });

    await mail.sendVerificationLink('student@scarletmail.rutgers.edu', 'tok en/?');

    expect(client.sent).toHaveLength(1);
    const payload = client.sent[0];
    expect(payload).toMatchObject({
      from: 'Rutgers Quad <auth@example.edu>',
      to: 'student@scarletmail.rutgers.edu',
      subject: 'Sign in to Rutgers Quad',
    });
    expect(payload?.text).toContain('https://quad-canvas-web-test.vercel.app/signin/confirm?token=tok+en%2F%3F');
    expect(payload?.html).toContain('href="https://quad-canvas-web-test.vercel.app/signin/confirm?token=tok+en%2F%3F"');
    expect(logs).toEqual(['verification email submitted for *@scarletmail.rutgers.edu (resend id email_123)']);
  });

  it('propagates Resend send failures without logging the token', async () => {
    const client = new FakeResendClient();
    client.response = {
      data: null,
      error: { name: 'validation_error', message: 'invalid from address', statusCode: 422 },
      headers: null,
    };
    const logs: string[] = [];
    const mail = new ResendMailTransport({
      client,
      baseUrl: 'https://quad-canvas-web-test.vercel.app',
      from: 'Rutgers Quad <auth@example.edu>',
      log: (m) => logs.push(m),
    });

    await expect(mail.sendVerificationLink('student@rutgers.edu', 'secret-token')).rejects.toThrow(
      'Resend verification email failed: invalid from address',
    );
    expect(logs.join('\n')).not.toContain('secret-token');
  });

  it('only the explicit dev logger emits the verification token', async () => {
    const logMessages: string[] = [];
    await new LogMailTransport((m) => logMessages.push(m)).sendVerificationLink('student@rutgers.edu', 'token-123');
    await new NullMailTransport((m) => logMessages.push(m)).sendVerificationLink('student@rutgers.edu', 'token-456');

    expect(logMessages[0]).toContain('token-123');
    expect(logMessages[1]).not.toContain('token-456');
  });
});
