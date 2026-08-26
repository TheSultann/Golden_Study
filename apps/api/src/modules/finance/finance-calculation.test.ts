import { describe, expect, it } from 'vitest';

import {
  calculateDailyLessonPrice,
  calculateMonthlyCharge,
  calculatePercentKpi,
  countActiveScheduledLessons,
  countScheduledLessons,
  monthlyChargeOperationKey,
  paymentOperationKey,
} from './finance-calculation.js';

describe('finance calculations', () => {
  it('counts scheduled lessons inside group boundaries including leap year', () => {
    expect(
      countScheduledLessons(
        '2028-02',
        ['MON', 'WED', 'FRI'],
        '2028-02-10',
        '2028-02-25',
      ),
    ).toBe(7);
  });

  it('mathematically rounds daily and monthly UZS charges', () => {
    expect(calculateDailyLessonPrice(1_000_000, 12)).toBe(83_333);
    expect(calculateMonthlyCharge(1_000_000, 7, 12)).toBe(583_333);
  });

  it('rejects zero lessons and invalid active-day counts', () => {
    expect(() => calculateDailyLessonPrice(500_000, 0)).toThrow(
      'Scheduled lessons must be positive',
    );
    expect(() => calculateMonthlyCharge(500_000, 13, 12)).toThrow(
      'Active lessons must be between zero and total lessons',
    );
  });

  it('uses decimal-safe percent KPI and stable operation keys', () => {
    expect(calculatePercentKpi(83_333, 8_000)).toBe(66_666);
    expect(paymentOperationKey('client-123')).toBe('payment:client-123');
    expect(
      monthlyChargeOperationKey(
        '2026-07',
        'group-id',
        'student-id',
      ),
    ).toBe(
      'monthly:2026-07:group:group-id:student:student-id:charge:v1',
    );
  });

  it('counts only membership lessons inside ACTIVE status periods', () => {
    expect(
      countActiveScheduledLessons(
        '2026-07',
        ['MON', 'WED', 'FRI'],
        '2026-01-01',
        '2026-12-31',
        new Date('2026-07-15T00:00:00.000Z'),
        null,
        [
          {
            status: 'ACTIVE',
            startedAt: new Date('2026-07-15T00:00:00.000Z'),
            endedAt: new Date('2026-07-21T00:00:00.000Z'),
          },
          {
            status: 'FROZEN',
            startedAt: new Date('2026-07-21T00:00:00.000Z'),
            endedAt: null,
          },
        ],
      ),
    ).toBe(3);
  });
});
