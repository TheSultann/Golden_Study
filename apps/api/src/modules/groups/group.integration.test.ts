import { Role } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../app.js';
import { prisma } from '../../config/prisma.js';
import { hashPassword } from '../auth/password.service.js';
import { createAccessToken } from '../auth/token.service.js';

const prefix = 'Group Integration';
const adminId = '71000000-0000-4000-8000-000000000001';
let token = '';
let teacherToken = '';
let courseId = '';
let teacherId = '';
let secondTeacherId = '';
let roomId = '';
let groupId = '';

describe('Groups API', () => {
  beforeAll(async () => {
    const [admin, course, room, teacher, secondTeacher] =
      await prisma.$transaction([
        prisma.user.upsert({
          where: { id: adminId },
          update: { isActive: true },
          create: {
            id: adminId,
            login: 'group-integration-admin',
            passwordHash: await hashPassword('password123'),
            role: Role.SUPER_ADMIN,
          },
        }),
        prisma.course.create({
          data: {
            title: `${prefix} Course`,
            durationMonths: 6,
            pricePerMonthUzs: 500000,
          },
        }),
        prisma.room.create({ data: { name: `${prefix} Room` } }),
        prisma.teacher.create({
          data: {
            firstName: 'Group',
            lastName: 'Teacher',
            phone: '+998900002001',
            salaryType: 'FIXED',
            fixedSalaryUzs: 1,
          },
        }),
        prisma.teacher.create({
          data: {
            firstName: 'Second',
            lastName: 'Teacher',
            phone: '+998900002002',
            salaryType: 'FIXED',
            fixedSalaryUzs: 1,
          },
        }),
      ]);
    courseId = course.id;
    roomId = room.id;
    teacherId = teacher.id;
    secondTeacherId = secondTeacher.id;
    const teacherUser = await prisma.user.create({
      data: {
        login: 'group-integration-teacher',
        passwordHash: await hashPassword('password123'),
        role: 'TEACHER',
        teacherId,
      },
    });
    token = createAccessToken({
      id: admin.id,
      login: admin.login,
      role: 'SUPER_ADMIN',
      teacherId: null,
    });
    teacherToken = createAccessToken({
      id: teacherUser.id,
      login: teacherUser.login,
      role: 'TEACHER',
      teacherId,
    });
  });

  afterAll(async () => {
    const testGroups = await prisma.group.findMany({
      where: { name: { startsWith: prefix } },
      select: { id: true },
    });
    await prisma.groupStudent.deleteMany({
      where: { groupId: { in: testGroups.map((group) => group.id) } },
    });
    await prisma.student.deleteMany({
      where: { studentCode: 'ST-GROUP-LIFECYCLE' },
    });
    await prisma.group.deleteMany({ where: { name: { startsWith: prefix } } });
    await prisma.user.deleteMany({
      where: { login: { startsWith: 'group-integration-' } },
    });
    await prisma.teacher.deleteMany({
      where: { phone: { startsWith: '+998900002' } },
    });
    await prisma.room.deleteMany({ where: { name: { startsWith: prefix } } });
    await prisma.course.deleteMany({ where: { title: { startsWith: prefix } } });
  });

  it('creates group and calculates end date from course duration', async () => {
    const response = await auth(
      request(createApp()).post('/api/v1/groups'),
    ).send({
      name: `${prefix} A`,
      courseId,
      teacherId,
      roomId,
      weekdays: ['MON', 'WED', 'FRI'],
      lessonStartMinutes: 600,
      lessonDurationMinutes: 90,
      startDate: '2026-08-31',
    });
    expect(response.status).toBe(201);
    expect((response.body as { data: unknown }).data).toMatchObject({
      endDate: '2027-02-28',
      studentsCount: 0,
      status: 'ACTIVE',
    });
    groupId = (response.body as { data: { id: string } }).data.id;
  });

  it('rejects teacher and room schedule conflicts', async () => {
    const teacherConflict = await auth(
      request(createApp()).post('/api/v1/groups'),
    ).send({
      name: `${prefix} Teacher conflict`,
      courseId,
      teacherId,
      weekdays: ['MON'],
      lessonStartMinutes: 650,
      lessonDurationMinutes: 60,
      startDate: '2026-09-01',
    });
    expect(teacherConflict.status).toBe(409);

    const roomConflict = await auth(
      request(createApp()).post('/api/v1/groups'),
    ).send({
      name: `${prefix} Room conflict`,
      courseId,
      teacherId: secondTeacherId,
      roomId,
      weekdays: ['WED'],
      lessonStartMinutes: 500,
      lessonDurationMinutes: 180,
      startDate: '2026-09-01',
    });
    expect(roomConflict.status).toBe(409);
  });

  it('scopes teacher list and detail to own groups', async () => {
    const list = await request(createApp())
      .get('/api/v1/groups')
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(list.status).toBe(200);
    expect((list.body as { meta: { total: number } }).meta.total).toBe(1);

    const foreign = await prisma.group.create({
      data: {
        name: `${prefix} Foreign`,
        courseId,
        teacherId: secondTeacherId,
        weekdays: ['TUE'],
        lessonStartMinutes: 600,
        lessonDurationMinutes: 90,
        startDate: new Date('2026-09-01'),
        endDate: new Date('2027-03-01'),
      },
    });
    expect(
      (
        await request(createApp())
          .get(`/api/v1/groups/${foreign.id}`)
          .set('Authorization', `Bearer ${teacherToken}`)
      ).status,
    ).toBe(403);
  });

  it('completes group, graduates memberships, then reactivates without restoring them', async () => {
    const student = await prisma.student.create({
      data: {
        studentCode: 'ST-GROUP-LIFECYCLE',
        firstName: 'Lifecycle',
        lastName: 'Student',
        groups: { create: { groupId } },
      },
    });

    expect(
      (
        await auth(
          request(createApp()).patch(`/api/v1/groups/${groupId}`),
        ).send({ lessonStartMinutes: 720 })
      ).status,
    ).toBe(200);

    const completed = await auth(
      request(createApp()).patch(`/api/v1/groups/${groupId}/status`),
    ).send({ status: 'COMPLETED' });
    expect(completed.status).toBe(200);
    expect((completed.body as { data: { status: string } }).data.status)
      .toBe('COMPLETED');
    expect(
      await prisma.groupStudent.findFirst({
        where: { groupId, studentId: student.id },
      }),
    ).toMatchObject({ status: 'GRADUATE' });
    expect(await prisma.student.findUnique({ where: { id: student.id } }))
      .toMatchObject({ status: 'GRADUATE' });

    const reactivated = await auth(
      request(createApp()).patch(`/api/v1/groups/${groupId}/status`),
    ).send({ status: 'ACTIVE' });
    expect(reactivated.status).toBe(200);
    expect((reactivated.body as { data: { status: string } }).data.status)
      .toBe('ACTIVE');
    expect(
      await prisma.groupStudent.findFirst({
        where: { groupId, studentId: student.id },
      }),
    ).toMatchObject({ status: 'GRADUATE' });

    expect(
      (await auth(request(createApp()).delete(`/api/v1/groups/${groupId}`)))
        .status,
    ).toBe(204);
  });
});

function auth(test: request.Test): request.Test {
  return test.set('Authorization', `Bearer ${token}`);
}
