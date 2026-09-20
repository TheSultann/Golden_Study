import {
  attendanceBulkSaveInputSchema,
  attendanceListQuerySchema,
} from '@golden-study/contracts';
import { describe, expect, it } from 'vitest';

const studentId = '00000000-0000-4000-8000-000000000001';
const groupId = '00000000-0000-4000-8000-000000000002';

describe('attendance API contracts', () => {
  it('rejects duplicate students in one bulk request', () => {
    expect(
      attendanceBulkSaveInputSchema.safeParse({
        groupId,
        date: '2026-07-08',
        items: [
          {
            studentId,
            status: 'CAME',
            rating: 5,
            homeworkDone: true,
            comment: '',
          },
          {
            studentId,
            status: 'ABSENT',
            rating: null,
            homeworkDone: false,
            comment: '',
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('requires rating for CAME and permits null for absence', () => {
    const base = {
      groupId,
      date: '2026-07-08',
      items: [
        {
          studentId,
          status: 'CAME',
          rating: null,
          homeworkDone: true,
          comment: '',
        },
      ],
    };
    expect(attendanceBulkSaveInputSchema.safeParse(base).success).toBe(false);
    expect(
      attendanceBulkSaveInputSchema.safeParse({
        ...base,
        items: [{ ...base.items[0], status: 'EXCUSED' }],
      }).success,
    ).toBe(true);
  });

  it('validates list date range', () => {
    expect(
      attendanceListQuerySchema.safeParse({
        dateFrom: '2026-07-10',
        dateTo: '2026-07-01',
      }).success,
    ).toBe(false);
  });

  it('validates rating within 0 to 100 percent for CAME', () => {
    const validZero = {
      groupId,
      date: '2026-07-08',
      items: [
        {
          studentId,
          status: 'CAME',
          rating: 0,
          homeworkDone: true,
          comment: '',
        },
      ],
    };
    expect(attendanceBulkSaveInputSchema.safeParse(validZero).success).toBe(true);

    const validHundred = {
      groupId,
      date: '2026-07-08',
      items: [
        {
          studentId,
          status: 'CAME',
          rating: 100,
          homeworkDone: true,
          comment: '',
        },
      ],
    };
    expect(attendanceBulkSaveInputSchema.safeParse(validHundred).success).toBe(true);

    const invalidTooHigh = {
      groupId,
      date: '2026-07-08',
      items: [
        {
          studentId,
          status: 'CAME',
          rating: 101,
          homeworkDone: true,
          comment: '',
        },
      ],
    };
    expect(attendanceBulkSaveInputSchema.safeParse(invalidTooHigh).success).toBe(false);

    const invalidNegative = {
      groupId,
      date: '2026-07-08',
      items: [
        {
          studentId,
          status: 'CAME',
          rating: -1,
          homeworkDone: true,
          comment: '',
        },
      ],
    };
    expect(attendanceBulkSaveInputSchema.safeParse(invalidNegative).success).toBe(false);
  });

  it('validates homeworkText and score breakdown in attendanceBulkSaveInputSchema', () => {
    const withBreakdown = {
      groupId,
      date: '2026-07-08',
      homeworkText: 'Mashq 12-15, yangi lug‘at 20 ta so‘z',
      items: [
        {
          studentId,
          status: 'CAME',
          homeworkScore: 90,
          topicScore: 85,
          dictionaryScore: 95,
          homeworkDone: true,
          comment: '',
        },
      ],
    };
    const parsed = attendanceBulkSaveInputSchema.safeParse(withBreakdown);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.homeworkText).toBe('Mashq 12-15, yangi lug‘at 20 ta so‘z');
      const item = parsed.data.items[0]!;
      expect(item.homeworkScore).toBe(90);
      expect(item.topicScore).toBe(85);
      expect(item.dictionaryScore).toBe(95);
    }

    const invalidScore = {
      groupId,
      date: '2026-07-08',
      items: [
        {
          studentId,
          status: 'CAME',
          homeworkScore: 105,
          topicScore: 85,
          dictionaryScore: 95,
          homeworkDone: true,
          comment: '',
        },
      ],
    };
    expect(attendanceBulkSaveInputSchema.safeParse(invalidScore).success).toBe(false);
  });
});

