import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../app.js';
import { prisma } from '../../config/prisma.js';
import { hashPassword } from '../auth/password.service.js';
import { createAccessToken } from '../auth/token.service.js';

const prefix = 'Student Integration';
const adminId = '72000000-0000-4000-8000-000000000001';
let adminToken = '';
let teacherToken = '';
let groupId = '';
let foreignGroupId = '';
let studentId = '';

describe('Students and memberships API', () => {
  beforeAll(async () => {
    const admin = await prisma.user.upsert({
      where: { id: adminId },
      update: { isActive: true },
      create: {
        id: adminId,
        login: 'student-integration-admin',
        passwordHash: await hashPassword('password123'),
        role: 'SUPER_ADMIN',
      },
    });
    const course = await prisma.course.create({
      data: {
        title: `${prefix} Course`,
        durationMonths: 6,
        pricePerMonthUzs: 500000,
      },
    });
    const [teacher, foreignTeacher] = await Promise.all([
      prisma.teacher.create({
        data: {
          firstName: 'Student',
          lastName: 'Teacher',
          phone: '+998900003001',
          salaryType: 'FIXED',
          fixedSalaryUzs: 1,
        },
      }),
      prisma.teacher.create({
        data: {
          firstName: 'Foreign',
          lastName: 'Teacher',
          phone: '+998900003002',
          salaryType: 'FIXED',
          fixedSalaryUzs: 1,
        },
      }),
    ]);
    const teacherUser = await prisma.user.create({
      data: {
        login: 'student-integration-teacher',
        passwordHash: await hashPassword('password123'),
        role: 'TEACHER',
        teacherId: teacher.id,
      },
    });
    const groups = await Promise.all([
      prisma.group.create({
        data: {
          name: `${prefix} Own`,
          courseId: course.id,
          teacherId: teacher.id,
          weekdays: ['MON'],
          lessonStartMinutes: 600,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-07-01'),
        },
      }),
      prisma.group.create({
        data: {
          name: `${prefix} Foreign`,
          courseId: course.id,
          teacherId: foreignTeacher.id,
          weekdays: ['TUE'],
          lessonStartMinutes: 600,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-07-01'),
        },
      }),
    ]);
    groupId = groups[0].id;
    foreignGroupId = groups[1].id;
    adminToken = createAccessToken({
      id: admin.id,
      login: admin.login,
      role: 'SUPER_ADMIN',
      teacherId: null,
    });
    teacherToken = createAccessToken({
      id: teacherUser.id,
      login: teacherUser.login,
      role: 'TEACHER',
      teacherId: teacher.id,
    });
  });

  afterAll(async () => {
    const financeEntries = await prisma.ledgerEntry.findMany({
      where: { teacher: { phone: { startsWith: '+998900003' } } },
      select: { id: true },
    });
    await prisma.ledgerEntry.deleteMany({
      where: { reversalOfId: { in: financeEntries.map(({ id }) => id) } },
    });
    await prisma.ledgerEntry.deleteMany({
      where: { teacher: { phone: { startsWith: '+998900003' } } },
    });
    await prisma.groupStudent.deleteMany({
      where: { group: { name: { startsWith: prefix } } },
    });
    await prisma.studentStatusPeriod.deleteMany({
      where: { student: { firstName: { startsWith: prefix } } },
    });
    await prisma.student.deleteMany({
      where: { firstName: { startsWith: prefix } },
    });
    await prisma.group.deleteMany({ where: { name: { startsWith: prefix } } });
    await prisma.user.deleteMany({
      where: { login: { startsWith: 'student-integration-' } },
    });
    await prisma.teacher.deleteMany({
      where: { phone: { startsWith: '+998900003' } },
    });
    await prisma.course.deleteMany({ where: { title: { startsWith: prefix } } });
  });

  it('generates unique increasing student codes atomically', async () => {
    const responses = await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        auth(request(createApp()).post('/api/v1/students')).send({
          firstName: `${prefix} ${index}`,
          lastName: 'Atomic',
          phone: `+99890100${String(index).padStart(4, '0')}`,
        }),
      ),
    );
    expect(responses.every((response) => response.status === 201)).toBe(true);
    const codes = responses.map(
      (response) =>
        (response.body as { data: { studentCode: string } }).data.studentCode,
    );
    expect(new Set(codes).size).toBe(5);
    expect(codes.every((code) => /^ST\d+$/.test(code))).toBe(true);
    studentId = (responses[0]!.body as { data: { id: string } }).data.id;
  });

  it('supports update, freeze and unfreeze', async () => {
    const updated = await auth(
      request(createApp()).patch(`/api/v1/students/${studentId}`),
    ).send({ address: 'Tashkent' });
    expect(updated.status).toBe(200);

    expect(
      (
        await auth(
          request(createApp()).patch(`/api/v1/students/${studentId}/freeze`),
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await auth(
          request(createApp()).patch(`/api/v1/students/${studentId}/unfreeze`),
        )
      ).status,
    ).toBe(200);
    const periods = await prisma.studentStatusPeriod.findMany({
      where: { studentId },
      orderBy: { startedAt: 'asc' },
    });
    expect(periods.map(({ status }) => status)).toEqual([
      'ACTIVE',
      'FROZEN',
      'ACTIVE',
    ]);
    expect(periods.filter(({ endedAt }) => endedAt === null)).toHaveLength(1);
  });

  it('preserves membership history across remove, re-add and graduate', async () => {
    expect(
      (
        await auth(
          request(createApp()).post(`/api/v1/groups/${groupId}/students`),
        ).send({ studentId })
      ).status,
    ).toBe(201);
    expect(
      (
        await auth(
          request(createApp()).post(`/api/v1/groups/${groupId}/students`),
        ).send({ studentId })
      ).status,
    ).toBe(409);
    expect(
      (
        await auth(
          request(createApp()).delete(
            `/api/v1/groups/${groupId}/students/${studentId}`,
          ),
        )
      ).status,
    ).toBe(204);
    expect(
      (
        await auth(
          request(createApp()).post(`/api/v1/groups/${groupId}/students`),
        ).send({ studentId })
      ).status,
    ).toBe(201);
    expect(
      (
        await auth(
          request(createApp()).patch(
            `/api/v1/groups/${groupId}/students/${studentId}/graduate`,
          ),
        )
      ).status,
    ).toBe(200);

    const history = await prisma.groupStudent.findMany({
      where: { groupId, studentId },
      orderBy: { joinedAt: 'asc' },
    });
    expect(history).toHaveLength(2);
    expect(history.map((item) => item.status)).toEqual([
      'REMOVED',
      'GRADUATE',
    ]);
    expect(history.every((item) => item.leftAt !== null)).toBe(true);
  });

  it('scopes teacher reads to students from own groups', async () => {
    const list = await request(createApp())
      .get('/api/v1/students')
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(list.status).toBe(200);
    expect(
      (list.body as { data: Array<{ id: string }> }).data.some(
        (student) => student.id === studentId,
      ),
    ).toBe(true);

    const foreignStudent = await prisma.student.create({
      data: {
        studentCode: `STF${Date.now()}`,
        firstName: `${prefix} Foreign`,
        lastName: 'Student',
        groups: { create: { groupId: foreignGroupId } },
      },
    });
    expect(
      (
        await request(createApp())
          .get(`/api/v1/students/${foreignStudent.id}`)
          .set('Authorization', `Bearer ${teacherToken}`)
      ).status,
    ).toBe(403);
  });

  it('archives student and closes active memberships', async () => {
    await auth(
      request(createApp()).post(`/api/v1/groups/${groupId}/students`),
    ).send({ studentId });
    expect(
      (await auth(request(createApp()).delete(`/api/v1/students/${studentId}`)))
        .status,
    ).toBe(204);
    expect(await prisma.student.findUnique({ where: { id: studentId } }))
      .toMatchObject({ status: 'ARCHIVED' });
    expect(
      await prisma.groupStudent.count({
        where: { studentId, status: 'ACTIVE' },
      }),
    ).toBe(0);
  });
});

function auth(test: request.Test): request.Test {
  return test.set('Authorization', `Bearer ${adminToken}`);
}
