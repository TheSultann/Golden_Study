import { GroupStatus, Role, Weekday } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../app.js';
import { prisma } from '../../config/prisma.js';
import { createAccessToken } from '../auth/token.service.js';

const adminId = '70000000-0000-4000-8000-000000000101';
const teacherUserId = '70000000-0000-4000-8000-000000000102';
const suffix = Date.now().toString(36);

let adminToken = '';
let teacherToken = '';
let groupId = '';
let foreignGroupId = '';
let studentId = '';

describe('Exams API & notifications', () => {
  beforeAll(async () => {
    await prisma.user.upsert({
      where: { id: adminId },
      update: { isActive: true },
      create: {
        id: adminId,
        login: `exams-admin-${suffix}`,
        passwordHash: 'x',
        role: Role.SUPER_ADMIN,
      },
    });
    await prisma.user.upsert({
      where: { id: teacherUserId },
      update: { isActive: true },
      create: {
        id: teacherUserId,
        login: `exams-teacher-${suffix}`,
        passwordHash: 'x',
        role: Role.TEACHER,
      },
    });
    const teacher = await prisma.teacher.create({
      data: {
        firstName: 'Exam',
        lastName: `Teacher ${suffix}`,
        phone: '+998900099001',
        salaryType: 'FIXED',
        fixedSalaryUzs: 1,
      },
    });
    await prisma.user.update({
      where: { id: teacherUserId },
      data: { teacherId: teacher.id },
    });

    const course = await prisma.course.create({
      data: {
        title: `Exam Course ${suffix}`,
        durationMonths: 4,
        pricePerMonthUzs: 400000,
      },
    });
    const group = await prisma.group.create({
      data: {
        name: `Exam Group ${suffix}`,
        courseId: course.id,
        teacherId: teacher.id,
        weekdays: [Weekday.MON, Weekday.WED],
        lessonStartMinutes: 600,
        status: GroupStatus.ACTIVE,
        startDate: new Date('2026-08-01'),
      },
    });
    const foreignGroup = await prisma.group.create({
      data: {
        name: `Exam Foreign Group ${suffix}`,
        courseId: course.id,
        teacherId: (
          await prisma.teacher.create({
            data: {
              firstName: 'Other',
              lastName: `Teacher ${suffix}`,
              phone: '+998900099002',
              salaryType: 'FIXED',
              fixedSalaryUzs: 1,
            },
          })
        ).id,
        weekdays: [Weekday.TUE],
        lessonStartMinutes: 720,
        status: GroupStatus.ACTIVE,
        startDate: new Date('2026-08-01'),
      },
    });
    const student = await prisma.student.create({
      data: {
        studentCode: `EXT${suffix.toUpperCase()}`,
        firstName: 'Ali',
        lastName: `Valiyev ${suffix}`,
      },
    });
    await prisma.groupStudent.create({
      data: { groupId: group.id, studentId: student.id },
    });

    groupId = group.id;
    foreignGroupId = foreignGroup.id;
    studentId = student.id;

    adminToken = createAccessToken({
      id: adminId,
      login: `exams-admin-${suffix}`,
      role: 'SUPER_ADMIN',
      teacherId: null,
    });
    teacherToken = createAccessToken({
      id: teacherUserId,
      login: `exams-teacher-${suffix}`,
      role: 'TEACHER',
      teacherId: teacher.id,
    });
  });

  afterAll(async () => {
    await prisma.examResult.deleteMany({ where: { studentId } });
    await prisma.exam.deleteMany({ where: { groupId: { in: [groupId, foreignGroupId] } } });
    await prisma.groupStudent.deleteMany({ where: { groupId } });
    await prisma.student.delete({ where: { id: studentId } }).catch(() => undefined);
    await prisma.group.deleteMany({
      where: { name: { endsWith: suffix } },
    });
    await prisma.user.deleteMany({
      where: { login: { startsWith: 'exams-' } },
    });
    await prisma.teacher.deleteMany({
      where: { lastName: { endsWith: suffix } },
    });
    await prisma.course.deleteMany({ where: { title: { endsWith: suffix } } });
  });

  it('creates an exam with results and returns normalized payload', async () => {
    const response = await request(createApp())
      .put(`/api/v1/exams/e-test-${suffix}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        groupId,
        name: 'Unit 1 test',
        date: '2026-08-20',
        maxScore: 100,
        results: [
          {
            studentId,
            score: 85,
            comment: 'yaxshi',
            rank: 1,
          },
        ],
      });

    expect(response.status).toBe(200);
    const created = response.body as {
      data: {
        groupName: string;
        results: Array<{ studentCode: string; score: number }>;
      };
    };
    expect(created.data.groupName).toContain('Exam Group');
    expect(created.data.results[0]?.studentCode).toContain('EXT');
    expect(created.data.results[0]?.score).toBe(85);
  });

  it('lists exams for admin', async () => {
    const response = await request(createApp())
      .get('/api/v1/exams')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    const body = response.body as { data: Array<{ name: string }> };
    const names = body.data.map((e) => e.name);
    expect(names).toContain('Unit 1 test');
  });

  it('forbids a teacher from saving an exam for a foreign group', async () => {
    const response = await request(createApp())
      .put(`/api/v1/exams/e-test-foreign-${suffix}`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        groupId: foreignGroupId,
        name: 'Foreign attempt',
        date: '2026-08-20',
        maxScore: 100,
        results: [],
      });

    expect(response.status).toBe(403);
  });

  it('queues exam_result notifications only for scored results of active links', async () => {
    const link = await prisma.telegramLink.create({
      data: {
        telegramChatId: `exam-chat-${suffix}`,
        studentId,
        status: 'ACTIVE',
      },
    });

    await request(createApp())
      .put(`/api/v1/exams/e-notif-${suffix}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        groupId,
        name: 'Notified exam',
        date: '2026-08-21',
        maxScore: 100,
        results: [{ studentId, score: 70, comment: '', rank: 1 }],
      });

    const log = await prisma.telegramNotificationLog.findFirst({
      where: { telegramLinkId: link.id, triggerType: 'EXAM_RESULT' },
    });
    expect(log).not.toBeNull();
    expect(log?.status).toBe('QUEUED');
    const payload = JSON.parse(log?.payload ?? '{}') as {
      examName?: string;
      score?: number;
    };
    expect(payload.examName).toBe('Notified exam');
    expect(payload.score).toBe(70);

    await prisma.telegramLink.delete({ where: { id: link.id } });
  });

  it('deletes an exam', async () => {
    const response = await request(createApp())
      .delete(`/api/v1/exams/e-test-${suffix}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(response.status).toBe(200);

    const remaining = await prisma.exam.findMany({
      where: { groupId },
    });
    expect(remaining.map((exam) => exam.name)).toEqual(['Notified exam']);
  });
});
