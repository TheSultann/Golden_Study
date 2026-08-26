import { describe, expect, it } from 'vitest';

import {
  calculateGroupEndDate,
  schedulesOverlap,
} from './group-schedule.js';

describe('group schedule rules', () => {
  it('adds course months and clamps to last day of target month', () => {
    expect(calculateGroupEndDate('2026-08-31', 6)).toBe('2027-02-28');
  });

  it('detects overlap only on common weekday and intersecting time', () => {
    expect(
      schedulesOverlap(
        ['MON', 'WED'],
        600,
        90,
        ['MON'],
        650,
        60,
      ),
    ).toBe(true);
    expect(
      schedulesOverlap(['MON'], 600, 90, ['MON'], 690, 60),
    ).toBe(false);
    expect(
      schedulesOverlap(['MON'], 600, 90, ['TUE'], 650, 60),
    ).toBe(false);
  });
});
