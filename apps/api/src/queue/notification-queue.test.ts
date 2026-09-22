import { describe, expect, it } from 'vitest';
import { sanitizeBullMqJobId } from './notification-queue.js';

describe('notification-queue jobId sanitization', () => {
  it('replaces all colons with underscores for BullMQ compatibility', () => {
    expect(sanitizeBullMqJobId('att:group-1:student-2:2026-09-20')).toBe(
      'att_group-1_student-2_2026-09-20',
    );
    expect(sanitizeBullMqJobId('lesson-broadcast:group-1:2026-09-20')).toBe(
      'lesson-broadcast_group-1_2026-09-20',
    );
  });

  it('returns undefined if jobId is not provided or empty', () => {
    expect(sanitizeBullMqJobId(undefined)).toBeUndefined();
    expect(sanitizeBullMqJobId('')).toBeUndefined();
  });

  it('leaves already sanitized or plain IDs intact', () => {
    expect(sanitizeBullMqJobId('simple-job-123')).toBe('simple-job-123');
  });
});
