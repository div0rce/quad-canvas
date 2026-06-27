import { describe, it, expect } from 'vitest';
import { queueMessage, actionMessage } from './moderation-client';

describe('queueMessage', () => {
  it('is empty on success and explains auth/permission failures', () => {
    expect(queueMessage(200)).toBe('');
    expect(queueMessage(401)).toMatch(/sign in/i);
    expect(queueMessage(403)).toMatch(/moderator access/i);
    expect(queueMessage(404)).toMatch(/no canvas/i);
    expect(queueMessage(500)).toMatch(/could not load/i);
  });
});

describe('actionMessage', () => {
  it('maps action outcomes', () => {
    expect(actionMessage(200)).toMatch(/done/i);
    expect(actionMessage(401)).toMatch(/sign in/i);
    expect(actionMessage(403)).toMatch(/moderator access/i);
    expect(actionMessage(404)).toMatch(/not found/i);
    expect(actionMessage(500)).toMatch(/failed/i);
  });
});
