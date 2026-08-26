import { describe, expect, it } from 'vitest';

import {
  attendanceOperationKey,
  isMembershipActiveOnDate,
  shouldChargeAttendance,
} from './attendance-policy.js';

describe('attendance policy', () => {
  it('builds stable versioned billing operation key', () => {
    expect(attendanceOperationKey('attendance-id')).toBe(
      'attendance:attendance-id:charge:v1',
    );
  });

  it('charges came and absent but not excused', () => {
    expect(shouldChargeAttendance('CAME')).toBe(true);
    expect(shouldChargeAttendance('ABSENT')).toBe(true);
    expect(shouldChargeAttendance('EXCUSED')).toBe(false);
  });

  it('checks membership boundaries for local business date', () => {
    expect(
      isMembershipActiveOnDate(
        new Date('2026-07-08T10:00:00.000Z'),
        null,
        '2026-07-08',
      ),
    ).toBe(true);
    expect(
      isMembershipActiveOnDate(
        new Date('2026-07-09T00:00:00.000Z'),
        null,
        '2026-07-08',
      ),
    ).toBe(false);
    expect(
      isMembershipActiveOnDate(
        new Date('2026-07-01T00:00:00.000Z'),
        new Date('2026-07-07T23:59:59.000Z'),
        '2026-07-08',
      ),
    ).toBe(false);
  });
});
