import { GroupStatus, Role, Weekday } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../app.js';
import { prisma } from '../../config/prisma.js';
import { createAccessToken } from '../auth/token.service.js';

const adminId = '70000000-0000-4000-8000-000000000111';
const suffix = Date.now().toString(36);

let adminToken = '';
let groupId = '';
let studentId = '';
let linkId = '';

describe('Announcements API & Telegram broadcast', () => {
  beforeAll(async () => {
    await prisma.user.upsert({
      where: { id: adminId },
      update: { isActive: true },
      create: {
        id: adminId,
        login: `ann-admin-${suffix}`,
        passwordHash: 'x',
        role: Role.SUPER_ADMIN,
      },
    });
    adminToken = createAccessToken({
      id: adminId,
      login: `ann-admin-${suffix}`,
      role: 'SUPER_ADMIN',
      teacherId: null,
    });

    const course = await prisma.course.create({
      data: {
        title: `Ann Course ${suffix}`,
        durationMonths: 4,
        pricePerMonthUzs: 400000,
      },
    });
    const teacher = await prisma.teacher.create({
      data: {
        firstName: 'Ann',
        lastName: `Teacher ${suffix}`,
        phone: '+998900099011',
        salaryType: 'FIXED',
        fixedSalaryUzs: 1,
      },
    });
    const group = await prisma.group.create({
      data: {
        name: `Ann Group ${suffix}`,
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
        studentCode: `ANN${suffix.toUpperCase()}`,
        firstName: 'Aziz',
        lastName: `Karimov ${suffix}`,
      },
    });
    const link = await prisma.telegramLink.create({
      data: {
        telegramChatId: `ann-chat-${suffix}`,
        studentId: student.id,
        status: 'ACTIVE',
      },
    });
    await prisma.groupStudent.create({
      data: { groupId: group.id, studentId: student.id },
    });

    groupId = group.id;
    studentId = student.id;
    linkId = link.id;
  });
  afterAll(async () => {
    await prisma.telegramNotificationLog.deleteMany({ where: { telegramLinkId: linkId } });
    await prisma.announcement.deleteMany({
      where: { targetName: { endsWith: suffix } },
    });
    await prisma.announcement.deleteMany({
      where: { title: { startsWith: 'Scheduled' } },
    });
    await prisma.telegramLink.deleteMany({ where: { telegramChatId: `ann-chat-${suffix}` } });
    await prisma.groupStudent.deleteMany({ where: { groupId } });
    await prisma.student.delete({ where: { id: studentId } }).catch(() => undefined);
    await prisma.group.deleteMany({ where: { name: { endsWith: suffix } } });
    await prisma.teacher.deleteMany({ where: { lastName: { endsWith: suffix } } });
    await prisma.course.deleteMany({ where: { title: { endsWith: suffix } } });
    await prisma.user.delete({ where: { id: adminId } }).catch(() => undefined);
  });

  it('broadcasts an immediate announcement to active links', async () => {
    const response = await request(createApp())
      .post('/api/v1/announcements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        targetType: 'group',
        targetId: groupId,
        title: 'Dars vaqti ozgardi',
        body: 'Ertaga dars 10:00 da boshlanadi.',
      });

    expect(response.status).toBe(201);
    const created = response.body as {
      data: { deliveryStatus: string; deliveredAt: string | null };
    };
    expect(created.data.deliveryStatus).toBe('BOT_DELIVERED');
    expect(created.data.deliveredAt).not.toBeNull();

    const log = await prisma.telegramNotificationLog.findFirst({
      where: { telegramLinkId: linkId, triggerType: 'ANNOUNCEMENT' },
    });
    expect(log).not.toBeNull();
    const payload = JSON.parse(log?.payload ?? '{}') as { title?: string };
    expect(payload.title).toBe('Dars vaqti ozgardi');
  });

  it('keeps a scheduled announcement in SCHEDULED state', async () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const response = await request(createApp())
      .post('/api/v1/announcements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        targetType: 'all',
        title: `Scheduled ${suffix}`,
        body: 'Keyin yuboriladi',
        scheduledAt: future,
      });

    expect(response.status).toBe(201);
    const scheduled = response.body as {
      data: { deliveryStatus: string; scheduledAt: string | null };
    };
    expect(scheduled.data.deliveryStatus).toBe('scheduled');
    expect(scheduled.data.scheduledAt).toBe(future);
  });

  it('validates the send input', async () => {
    const response = await request(createApp())
      .post('/api/v1/announcements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        targetType: 'course',
        title: '',
        body: 'x',
      });

    expect(response.status).toBe(400);
  });
});
