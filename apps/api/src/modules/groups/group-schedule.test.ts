import { describe, expect, it } from 'vitest';

import {
  calculateGroupEndDate,
  calculateNextLesson,
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

  it('calculates the next lesson date, time, and room display correctly', () => {
    // Current date is 2026-09-20 (Sunday)
    // Weekdays are MON, WED, FRI
    // Next lesson should be 2026-09-21 (Monday) at 09:00 (540 mins)
    const nextLesson = calculateNextLesson('2026-09-20', ['MON', 'WED', 'FRI'], 540, '204-xona');
    expect(nextLesson).not.toBeNull();
    expect(nextLesson?.dateIso).toBe('2026-09-21');
    expect(nextLesson?.dateFormatted).toBe('21.09.2026');
    expect(nextLesson?.timeFormatted).toBe('09:00');
    expect(nextLesson?.roomName).toBe('204-xona');
    expect(nextLesson?.displaySummary).toBe('21.09.2026, 09:00 (204-xona)');
  });

  it('handles weekend jumps when calculating next lesson', () => {
    // Current date is 2026-09-25 (Friday)
    // Weekdays are MON, WED, FRI
    // Next lesson should skip Saturday/Sunday to 2026-09-28 (Monday)
    const nextLesson = calculateNextLesson('2026-09-25', ['MON', 'WED', 'FRI'], 840, null);
    expect(nextLesson).not.toBeNull();
    expect(nextLesson?.dateIso).toBe('2026-09-28');
    expect(nextLesson?.timeFormatted).toBe('14:00');
    expect(nextLesson?.displaySummary).toBe('28.09.2026, 14:00');
  });

  it('returns null if weekdays array is empty', () => {
    const nextLesson = calculateNextLesson('2026-09-20', [], 540);
    expect(nextLesson).toBeNull();
  });
});
