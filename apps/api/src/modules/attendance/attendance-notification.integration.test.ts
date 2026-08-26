import { GroupStatus, Role, Weekday } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../app.js';
import { prisma } from '../../config/prisma.js';
import { createAccessToken } from '../auth/token.service.js';

const adminId = '70000000-0000-4000-8000-000000000121';
const suffix = Date.now().toString(36);

let adminToken = '';
let groupId = '';
let studentId = '';
let linkId = '';

describe('Attendance Telegram notifications', () => {
  beforeAll(async () => {
    await prisma.user.upsert({
      where: { id: adminId },
      update: { isActive: true },
      create: {
        id: adminId,
        login: `att-ntf-admin-${suffix}`,
        passwordHash: 'x',
        role: Role.SUPER_ADMIN,
      },
    });
    adminToken = createAccessToken({
      id: adminId,
      login: `att-ntf-admin-${suffix}`,
      role: 'SUPER_ADMIN',
      teacherId: null,
    });

    const course = await prisma.course.create({
      data: {
        title: `AttNtf Course ${suffix}`,
        durationMonths: 4,
        pricePerMonthUzs: 400000,
      },
    });
    const teacher = await prisma.teacher.create({
      data: {
        firstName: 'Att',
        lastName: `Teacher ${suffix}`,
        phone: '+998900099021',
        salaryType: 'FIXED',
        fixedSalaryUzs: 1,
      },
    });
    const group = await prisma.group.create({
      data: {
        name: `AttNtf Group ${suffix}`,
        courseId: course.id,
        teacherId: teacher.id,
        weekdays: [Weekday.MON],
        lessonStartMinutes: 600,
        status: GroupStatus.ACTIVE,
        startDate: new Date('2026-08-01'),
      },
    });
    const student = await prisma.student.create({
      data: {
        studentCode: `ATN${suffix.toUpperCase()}`,
        firstName: 'Bek',
        lastName: `Tosh ${suffix}`,
      },
    });
    const link = await prisma.telegramLink.create({
      data: {
        telegramChatId: `att-ntf-chat-${suffix}`,
        studentId: student.id,
        status: 'ACTIVE',
      },
    });
    await prisma.groupStudent.create({
      data: {
        groupId: group.id,
        studentId: student.id,
        joinedAt: new Date('2026-08-01'),
      },
    });

    groupId = group.id;
    studentId = student.id;
    linkId = link.id;
  });

  afterAll(async () => {
    await prisma.telegramNotificationLog.deleteMany({ where: { telegramLinkId: linkId } });
    await prisma.attendance.deleteMany({ where: { groupId } });
    await prisma.ledgerEntry.deleteMany({ where: { studentId } });
    await prisma.telegramLink.deleteMany({ where: { telegramChatId: `att-ntf-chat-${suffix}` } });
    await prisma.groupStudent.deleteMany({ where: { groupId } });
    await prisma.student.delete({ where: { id: studentId } }).catch(() => undefined);
    await prisma.group.deleteMany({ where: { name: { endsWith: suffix } } });
    await prisma.teacher.deleteMany({ where: { lastName: { endsWith: suffix } } });
    await prisma.course.deleteMany({ where: { title: { endsWith: suffix } } });
    await prisma.user.delete({ where: { id: adminId } }).catch(() => undefined);
  });

  async function saveAttendance(status: 'CAME' | 'ABSENT', homeworkDone: boolean) {
    return request(createApp())
      .post('/api/v1/attendance')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        groupId,
        date: '2026-08-20',
        items: [
          {
            studentId,
            status,
            rating: 4,
            homeworkDone,
            comment: '',
          },
        ],
      });
  }

  it('queues attendance_absent notification for ABSENT records', async () => {
    const response = await saveAttendance('ABSENT', false);
    expect(response.status).toBe(200);

    const log = await prisma.telegramNotificationLog.findFirst({
      where: { telegramLinkId: linkId, triggerType: 'ATTENDANCE_ABSENT' },
    });
    expect(log).not.toBeNull();
    expect(log?.jobId).toMatch(/^att:/);
  });

  it('does not duplicate notifications on re-save', async () => {
    await saveAttendance('ABSENT', false);
    await saveAttendance('ABSENT', false);

    const logs = await prisma.telegramNotificationLog.findMany({
      where: { telegramLinkId: linkId, triggerType: 'ATTENDANCE_ABSENT' },
    });
    expect(logs).toHaveLength(1);
  });

  it('queues homework_missing notification when homework is not done', async () => {
    await saveAttendance('CAME', false);

    const log = await prisma.telegramNotificationLog.findFirst({
      where: { telegramLinkId: linkId, triggerType: 'HOMEWORK_MISSING' },
    });
    expect(log).not.toBeNull();
  });

  it('queues nothing extra when everything is fine', async () => {
    const before = await prisma.telegramNotificationLog.count({
      where: { telegramLinkId: linkId },
    });
    await saveAttendance('CAME', true);
    const after = await prisma.telegramNotificationLog.count({
      where: { telegramLinkId: linkId },
    });
    expect(after).toBe(before);
  });
});
