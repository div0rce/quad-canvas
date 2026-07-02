import { describe, expect, it } from 'vitest';
import { handleValidationError } from './onboarding-client';

describe('handleValidationError', () => {
  it('accepts valid handles (@ is stripped)', () => {
    expect(handleValidationError('mira7')).toBeNull();
    expect(handleValidationError('@mira_7')).toBeNull();
    expect(handleValidationError('a-b-c')).toBeNull();
  });

  it('rejects empty, too-short/long, or illegal characters', () => {
    expect(handleValidationError('')).toBe('Pick a username.');
    expect(handleValidationError('  ')).toBe('Pick a username.');
    expect(handleValidationError('ab')).toMatch(/3.24/);
    expect(handleValidationError('has space')).toMatch(/3.24/);
    expect(handleValidationError('x'.repeat(25))).toMatch(/3.24/);
    expect(handleValidationError('no!bang')).toMatch(/3.24/);
  });
});
