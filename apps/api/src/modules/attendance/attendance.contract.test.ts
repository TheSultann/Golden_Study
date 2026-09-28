import {
  attendanceBulkSaveInputSchema,
  attendanceListQuerySchema,
  monthlyAttendanceResponseSchema,
  type AuthUser,
} from '@golden-study/contracts';
import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { AttendanceService } from './attendance.service.js';

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

  it('allows optional rating for CAME as well as absence', () => {
    const base = {
      groupId,
      date: '2026-07-08',
      items: [
        {
          studentId,
          status: 'CAME',
          rating: null,
          homeworkDone: false,
          comment: '',
        },
      ],
    };
    expect(attendanceBulkSaveInputSchema.safeParse(base).success).toBe(true);
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

  it('validates monthly attendance response schema correctly', () => {
    const validMonthly = {
      data: {
        groupId,
        groupName: 'General English B1',
        month: '2026-09',
        daysInMonth: 30,
        lessonDates: ['2026-09-02', '2026-09-04'],
        days: [
          {
            date: '2026-09-01',
            dayNumber: 1,
            weekday: 'Se',
            hasLesson: false,
            lessonTitle: null,
          },
          {
            date: '2026-09-02',
            dayNumber: 2,
            weekday: 'Chor',
            hasLesson: true,
            lessonTitle: 'Present Simple',
          },
        ],
        students: [
          {
            studentId,
            studentCode: 'GS-101',
            studentName: 'Aliyev Vali',
            phone: '+998901234567',
            days: {
              '2026-09-02': {
                status: 'came',
                rating: 90,
                homeworkDone: true,
                homeworkScore: 90,
                topicScore: 90,
                dictionaryScore: 90,
                comment: 'Yaxshi',
              },
            },
            stats: {
              totalLessons: 1,
              came: 1,
              excused: 0,
              absent: 0,
              unmarked: 0,
              percentage: 100,
              averageScore: 90,
            },
          },
        ],
        stats: {
          totalStudents: 1,
          totalLessons: 1,
          averageAttendancePercentage: 100,
        },
      },
    };
    const parsed = monthlyAttendanceResponseSchema.safeParse(validMonthly);
    expect(parsed.success).toBe(true);
  });

  it('correctly calculates monthly sheet attendance percentage excluding lessons before joinedAt', async () => {
    const mockPrisma = {
      group: {
        findUnique: vi.fn(async () => ({
          name: 'IELTS Intensive',
          weekdays: ['MON', 'WED', 'FRI'],
          teacherId: 't1',
        })),
      },
      groupStudent: {
        findMany: vi.fn(async () => [
          {
            groupId,
            studentId,
            joinedAt: new Date('2026-09-15T00:00:00.000Z'),
            leftAt: null,
            student: {
              id: studentId,
              studentCode: 'GS-101',
              firstName: 'Vali',
              lastName: 'Aliyev',
              phone: '+998901234567',
            },
          },
        ]),
      },
      attendance: {
        findMany: vi.fn(async () => [
          {
            id: 'att-1',
            studentId,
            date: new Date('2026-09-16T00:00:00.000Z'),
            status: 'CAME',
            rating: 90,
            homeworkScore: 90,
            topicScore: 90,
            dictionaryScore: 90,
            homeworkDone: true,
            comment: '',
          },
        ]),
      },
      groupLesson: {
        findMany: vi.fn(async () => []),
      },
    };

    const service = new AttendanceService(
      mockPrisma as unknown as PrismaClient,
    );
    const user: AuthUser = {
      id: 'u1',
      role: 'ADMIN',
      login: 'admin',
      teacherId: null,
    };
    const result = await service.getMonthlySheet(groupId, '2026-09', user);

    expect(result.students.length).toBe(1);
    const studentRow = result.students[0]!;
    expect(studentRow.stats.came).toBe(1);
    expect(studentRow.stats.excused).toBe(0);
    expect(studentRow.stats.absent).toBe(0);
    // Unmarked should ONLY count lessons from Sep 15 onwards: Sep 18, 21, 23, 25, 28, 30 (6 lessons)
    expect(studentRow.stats.unmarked).toBe(6);
    expect(studentRow.stats.totalLessons).toBe(7);
    expect(studentRow.stats.percentage).toBe(Math.round((1 / 7) * 100)); // 14%
  });
});

