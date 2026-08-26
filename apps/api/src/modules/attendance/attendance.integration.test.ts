import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../app.js';
import { prisma } from '../../config/prisma.js';
import { hashPassword } from '../auth/password.service.js';
import { createAccessToken } from '../auth/token.service.js';

const prefix = 'Attendance Integration';
const adminId = '74000000-0000-4000-8000-000000000001';
let adminToken = '';
let teacherToken = '';
let groupId = '';
let studentId = '';
let attendanceId = '';

describe('Attendance API', () => {
  beforeAll(async () => {
    await cleanupAttendanceFixtures();
    const admin = await prisma.user.upsert({
      where: { id: adminId },
      update: { isActive: true },
      create: {
        id: adminId,
        login: 'attendance-integration-admin',
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
    const teacher = await prisma.teacher.create({
      data: {
        firstName: 'Attendance',
        lastName: 'Teacher',
        phone: '+998900005001',
        salaryType: 'FIXED',
        fixedSalaryUzs: 1,
      },
    });
    const teacherUser = await prisma.user.create({
      data: {
        login: 'attendance-integration-teacher',
        passwordHash: await hashPassword('password123'),
        role: 'TEACHER',
        teacherId: teacher.id,
      },
    });
    const group = await prisma.group.create({
      data: {
        name: `${prefix} Group`,
        courseId: course.id,
        teacherId: teacher.id,
        weekdays: ['WED'],
        lessonStartMinutes: 600,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-07-31'),
      },
    });
    const student = await prisma.student.create({
      data: {
        studentCode: `STA${Date.now()}`,
        firstName: `${prefix} Student`,
        lastName: 'One',
        groups: {
          create: {
            groupId: group.id,
            joinedAt: new Date('2026-07-01T00:00:00.000Z'),
          },
        },
      },
    });
    groupId = group.id;
    studentId = student.id;
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

  afterAll(cleanupAttendanceFixtures);

  it('loads session students active on selected date', async () => {
    const response = await teacher(
      request(createApp()).get(
        `/api/v1/attendance/group/${groupId}/date/2026-07-08`,
      ),
    );
    expect(response.status).toBe(200);
    expect(
      (response.body as { data: { rows: Array<{ studentId: string }> } }).data
        .rows,
    ).toContainEqual(expect.objectContaining({ studentId }));
  });

  it('upserts once, admin locks row and teacher cannot overwrite it', async () => {
    const teacherSave = await teacher(
      request(createApp()).post('/api/v1/attendance'),
    ).send(session('CAME', 5));
    expect(teacherSave.status).toBe(200);
    attendanceId = (
      teacherSave.body as { data: { rows: Array<{ id: string }> } }
    ).data.rows[0]!.id;

    const adminSave = await admin(
      request(createApp()).post('/api/v1/attendance'),
    ).send(session('ABSENT', null));
    expect(adminSave.status).toBe(200);
    expect(
      (
        adminSave.body as {
          data: { rows: Array<{ lockedByAdmin: boolean }> };
        }
      ).data.rows[0]!.lockedByAdmin,
    ).toBe(true);
    expect(
      await prisma.attendance.count({
        where: { groupId, studentId, date: new Date('2026-07-08') },
      }),
    ).toBe(1);

    expect(
      (
        await teacher(
          request(createApp()).post('/api/v1/attendance'),
        ).send(session('CAME', 4))
      ).status,
    ).toBe(403);
  });

  it('allows admin correction and soft reversal', async () => {
    const corrected = await admin(
      request(createApp()).patch(`/api/v1/attendance/${attendanceId}`),
    ).send({
      status: 'EXCUSED',
      rating: null,
      homeworkDone: false,
      comment: 'Medical reason',
    });
    expect(corrected.status).toBe(200);
    expect(
      (corrected.body as { data: { status: string } }).data.status,
    ).toBe('EXCUSED');

    expect(
      (
        await admin(
          request(createApp()).delete(`/api/v1/attendance/${attendanceId}`),
        )
      ).status,
    ).toBe(204);
    expect(
      await prisma.attendance.findUnique({ where: { id: attendanceId } }),
    ).toMatchObject({ isReversed: true, reversedByUserId: adminId });
  });

  it('returns student attendance history with teacher ownership', async () => {
    const history = await teacher(
      request(createApp()).get(`/api/v1/students/${studentId}/attendance`),
    );
    expect(history.status).toBe(200);
    expect((history.body as { meta: { total: number } }).meta.total).toBe(1);
  });
});

async function cleanupAttendanceFixtures() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { id: adminId },
        { login: { startsWith: 'attendance-integration-' } },
      ],
    },
    select: { id: true },
  });
  const students = await prisma.student.findMany({
    where: { firstName: { startsWith: prefix } },
    select: { id: true },
  });
  const userIds = users.map(({ id }) => id);
  const studentIds = students.map(({ id }) => id);
  await prisma.auditLog.deleteMany({
    where: { actorUserId: { in: userIds } },
  });
  await prisma.payment.deleteMany({
    where: { studentId: { in: studentIds } },
  });
  const entries = await prisma.ledgerEntry.findMany({
    where: {
      OR: [
        { createdByUserId: { in: userIds } },
        { studentId: { in: studentIds } },
      ],
    },
    select: { id: true },
  });
  const entryIds = entries.map(({ id }) => id);
  await prisma.ledgerEntry.deleteMany({
    where: { reversalOfId: { in: entryIds } },
  });
  await prisma.ledgerEntry.deleteMany({ where: { id: { in: entryIds } } });
  await prisma.attendance.deleteMany({
    where: { group: { name: { startsWith: prefix } } },
  });
  await prisma.groupStudent.deleteMany({
    where: { group: { name: { startsWith: prefix } } },
  });
  await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
  await prisma.group.deleteMany({ where: { name: { startsWith: prefix } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.teacher.deleteMany({
    where: { phone: { startsWith: '+998900005' } },
  });
  await prisma.course.deleteMany({ where: { title: { startsWith: prefix } } });
}

function session(status: 'CAME' | 'ABSENT', rating: number | null) {
  return {
    groupId,
    date: '2026-07-08',
    items: [
      {
        studentId,
        status,
        rating,
        homeworkDone: status === 'CAME',
        comment: '',
      },
    ],
  };
}

function admin(test: request.Test): request.Test {
  return test.set('Authorization', `Bearer ${adminToken}`);
}

function teacher(test: request.Test): request.Test {
  return test.set('Authorization', `Bearer ${teacherToken}`);
}
