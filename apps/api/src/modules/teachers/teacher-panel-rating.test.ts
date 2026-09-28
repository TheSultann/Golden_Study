import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { TeacherPanelService } from './teacher-panel.service.js';
import type { AuthUser } from '@golden-study/contracts';

describe('TeacherPanelService - getRating', () => {
  it('returns all active groups for ADMIN role', async () => {
    const mockFindManyGroups = vi.fn().mockResolvedValue([
      {
        id: 'g1',
        name: 'Group 1',
        students: [
          {
            student: {
              id: 's1',
              studentCode: 'ST101',
              firstName: 'Ali',
              lastName: 'Valiyev',
            },
          },
        ],
      },
      {
        id: 'g2',
        name: 'Group 2',
        students: [
          {
            student: {
              id: 's2',
              studentCode: 'ST102',
              firstName: 'Vali',
              lastName: 'Aliyev',
            },
          },
        ],
      },
    ]);

    const mockFindManyAttendance = vi.fn().mockImplementation(({ where }) => {
      if (where?.studentId === 's1') {
        return Promise.resolve([
          { status: 'CAME', rating: 90, homeworkDone: true, isReversed: false },
          { status: 'CAME', rating: 100, homeworkDone: true, isReversed: false },
        ]);
      }
      return Promise.resolve([
        { status: 'CAME', rating: 60, homeworkDone: false, isReversed: false },
      ]);
    });

    const mockFindManyExamResults = vi.fn().mockImplementation(({ where }) => {
      if (where?.studentId === 's1') {
        return Promise.resolve([
          { score: 90, exam: { maxScore: 100 } },
        ]);
      }
      return Promise.resolve([]);
    });

    const mockPrisma = {
      group: { findMany: mockFindManyGroups },
      attendance: { findMany: mockFindManyAttendance },
      examResult: { findMany: mockFindManyExamResults },
      user: { findUnique: vi.fn() },
      teacher: { findFirst: vi.fn() },
    } as unknown as PrismaClient;

    const service = new TeacherPanelService(mockPrisma);
    const adminUser: AuthUser = {
      id: 'admin-1',
      login: 'admin',
      role: 'ADMIN',
      teacherId: null,
    };

    const result = await service.getRating(adminUser);

    expect(mockFindManyGroups).toHaveBeenCalledWith({
      where: { status: 'ACTIVE' },
      include: {
        course: true,
        students: { where: { status: 'ACTIVE' }, include: { student: true } },
      },
    });

    expect(result).toHaveLength(2);
    expect(result[0]!.studentCode).toBe('ST101');
    expect(result[0]!.groupName).toBe('Group 1');
    expect(result[0]!.examsCount).toBe(1);
    expect(result[0]!.averagePercent).toBe(90);
    expect(result[0]!.attendanceRate).toBe(100);
    expect(result[0]!.attendanceRating).toBe(95);
    expect(result[0]!.homeworkRate).toBe(100);
    // (90 * 0.4) + (100 * 0.2) + (95 * 0.2) + (100 * 0.2) = 36 + 20 + 19 + 20 = 95
    expect(result[0]!.totalScore).toBe(95);

    expect(result[1]!.studentCode).toBe('ST102');
    expect(result[1]!.groupName).toBe('Group 2');
    expect(result[1]!.examsCount).toBe(0);
    // totalScore without exams: (100/100)*40 + (60/100)*30 + 0 = 40 + 18 = 58
    expect(result[1]!.totalScore).toBe(58);
  });

  it('restricts to own groups for TEACHER role', async () => {
    const mockFindManyGroups = vi.fn().mockResolvedValue([
      {
        id: 'g-teacher',
        name: 'Teacher Group',
        students: [
          {
            student: {
              id: 's3',
              studentCode: 'ST103',
              firstName: 'Jasur',
              lastName: 'Karimov',
            },
          },
        ],
      },
    ]);

    const mockPrisma = {
      group: { findMany: mockFindManyGroups },
      attendance: { findMany: vi.fn().mockResolvedValue([]) },
      examResult: { findMany: vi.fn().mockResolvedValue([]) },
      user: { findUnique: vi.fn() },
      teacher: { findFirst: vi.fn() },
    } as unknown as PrismaClient;

    const service = new TeacherPanelService(mockPrisma);
    const teacherUser: AuthUser = {
      id: 'teacher-user-1',
      login: 'teacher.1',
      role: 'TEACHER',
      teacherId: 't-123',
    };

    const result = await service.getRating(teacherUser);

    expect(mockFindManyGroups).toHaveBeenCalledWith({
      where: { teacherId: 't-123', status: 'ACTIVE' },
      include: {
        course: true,
        students: { where: { status: 'ACTIVE' }, include: { student: true } },
      },
    });

    expect(result).toHaveLength(1);
    expect(result[0]!.studentCode).toBe('ST103');
    expect(result[0]!.totalScore).toBe(0);
  });
});
