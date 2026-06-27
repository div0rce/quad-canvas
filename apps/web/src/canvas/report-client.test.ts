import { describe, it, expect } from 'vitest';
import { reportStatusMessage } from './report-client';

describe('reportStatusMessage', () => {
  it('maps each report status', () => {
    expect(reportStatusMessage(201)).toMatch(/thank you/i);
    expect(reportStatusMessage(401)).toMatch(/sign in/i);
    expect(reportStatusMessage(422)).toMatch(/reason/i);
    expect(reportStatusMessage(429)).toMatch(/too many/i);
    expect(reportStatusMessage(500)).toMatch(/could not submit/i);
  });
});
