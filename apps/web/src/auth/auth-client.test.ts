import { describe, it, expect } from 'vitest';
import { isLikelyEmail, requestMessage, confirmMessage } from './auth-client';

describe('isLikelyEmail', () => {
  it('accepts well-formed addresses and rejects malformed ones', () => {
    expect(isLikelyEmail('mn801@scarletmail.rutgers.edu')).toBe(true);
    expect(isLikelyEmail('  a@b.co  ')).toBe(true);
    expect(isLikelyEmail('nope')).toBe(false);
    expect(isLikelyEmail('a@b')).toBe(false);
    expect(isLikelyEmail('a b@c.de')).toBe(false);
    expect(isLikelyEmail('')).toBe(false);
  });
});

describe('requestMessage', () => {
  it('maps each verify-request status', () => {
    expect(requestMessage(202)).toMatch(/check your email/i);
    expect(requestMessage(422)).toMatch(/valid email/i);
    expect(requestMessage(403)).toMatch(/eligible/i);
    expect(requestMessage(429)).toMatch(/too many/i);
    expect(requestMessage(500)).toMatch(/could not send/i);
  });
});

describe('confirmMessage', () => {
  it('maps each verify-confirm status', () => {
    expect(confirmMessage(200)).toMatch(/signed in/i);
    expect(confirmMessage(409)).toMatch(/invalid, expired/i);
    expect(confirmMessage(422)).toMatch(/missing or invalid/i);
    expect(confirmMessage(429)).toMatch(/too many/i);
    expect(confirmMessage(500)).toMatch(/could not complete/i);
  });
});
