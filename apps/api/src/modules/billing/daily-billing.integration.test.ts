import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../app.js';
import { prisma } from '../../config/prisma.js';
import { hashPassword } from '../auth/password.service.js';
import { createAccessToken } from '../auth/token.service.js';

const adminId = '76000000-0000-4000-8000-000000000001';
let token = '';
let groupId = '';
let studentId = '';

describe('DAILY billing through Attendance', () => {
  beforeAll(async () => {
    await cleanup();
    const admin = await prisma.user.upsert({
      where: { id: adminId },
      update: { isActive: true },
      create: {
        id: adminId,
        login: 'daily-billing-admin',
        passwordHash: await hashPassword('password123'),
        role: 'SUPER_ADMIN',
      },
    });
    await prisma.settings.upsert({
      where: { id: 'singleton' },
      update: { billingMode: 'DAILY' },
      create: {
        id: 'singleton',
        centerName: 'Golden Study',
        billingMode: 'DAILY',
      },
    });
    const course = await prisma.course.create({
      data: {
        title: 'Daily Billing Integration Course',
        durationMonths: 6,
        pricePerMonthUzs: 1_200_000,
      },
    });
    const teacher = await prisma.teacher.create({
      data: {
        firstName: 'Daily Billing',
        lastName: 'Teacher',
        phone: '+998900006001',
        salaryType: 'PERCENT',
        kpiRateBasisPoints: 8000,
      },
    });
    const group = await prisma.group.create({
      data: {
        name: 'Daily Billing Integration Group',
        courseId: course.id,
        teacherId: teacher.id,
        weekdays: ['MON', 'WED', 'FRI'],
        lessonStartMinutes: 600,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      },
    });
    const student = await prisma.student.create({
      data: {
        studentCode: `STDB${Date.now()}`,
        firstName: 'Daily Billing',
        lastName: 'Student',
        groups: {
          create: {
            groupId: group.id,
            joinedAt: new Date('2026-01-01'),
          },
        },
      },
    });
    groupId = group.id;
    studentId = student.id;
    token = createAccessToken({
      id: admin.id,
      login: admin.login,
      role: 'SUPER_ADMIN',
      teacherId: null,
    });
  });

  afterAll(cleanup);

  it('charges CAME once and reverses when changed to EXCUSED', async () => {
    const came = await save('CAME', 5);
    expect(came.status).toBe(200);
    const attendanceId = (
      came.body as { data: { rows: Array<{ id: string }> } }
    ).data.rows[0]!.id;
    const operationKey = `attendance:${attendanceId}:charge:v1`;
    const charge = await prisma.ledgerEntry.findUniqueOrThrow({
      where: { operationKey },
    });
    expect(charge).toMatchObject({
      studentId,
      direction: 'DEBIT',
      category: 'DAILY_LESSON_CHARGE',
      amountUzs: 85714,
    });
    const kpiEntry = await prisma.ledgerEntry.findUnique({
      where: { operationKey: `${operationKey}:kpi:percent:v1` },
    });
    expect(kpiEntry).not.toBeNull();
    expect(kpiEntry).toMatchObject({
      direction: 'CREDIT',
      category: 'KPI_PERCENT_ACCRUAL',
      amountUzs: 68571,
    });
    expect(kpiEntry?.teacherId).toBeTruthy();

    expect((await save('ABSENT', null)).status).toBe(200);
    expect(
      await prisma.ledgerEntry.count({ where: { operationKey } }),
    ).toBe(1);

    expect((await save('EXCUSED', null)).status).toBe(200);
    expect(
      await prisma.ledgerEntry.findFirst({
        where: { reversalOfId: charge.id },
      }),
    ).toMatchObject({
      direction: 'CREDIT',
      category: 'REVERSAL',
      amountUzs: 85714,
    });
    const kpi = await prisma.ledgerEntry.findUniqueOrThrow({
      where: { operationKey: `${operationKey}:kpi:percent:v1` },
    });
    expect(
      await prisma.ledgerEntry.findFirst({
        where: { reversalOfId: kpi.id },
      }),
    ).toMatchObject({ direction: 'DEBIT', amountUzs: 68571 });
  });

  it('reconciles a missing DAILY charge and lists billing runs', async () => {
    const date = '2026-07-10';
    await prisma.attendance.create({
      data: {
        groupId,
        studentId,
        date: new Date(`${date}T00:00:00.000Z`),
        status: 'CAME',
        rating: 5,
        createdByUserId: adminId,
      },
    });

    const reconciled = await auth(
      request(createApp()).post('/api/v1/billing/daily/reconcile'),
    ).send({ date });
    expect(reconciled.status).toBe(200);
    expect(reconciled.body).toMatchObject({
      data: {
        mode: 'DAILY',
        periodKey: date,
        status: 'COMPLETED',
        createdCount: 1,
      },
    });

    const runs = await auth(
      request(createApp()).get('/api/v1/billing/runs?mode=DAILY'),
    );
    expect(runs.status).toBe(200);
    expect(runs.body).toMatchObject({
      data: [{ mode: 'DAILY', periodKey: date }],
      meta: { page: 1 },
    });
  });

  async function save(status: 'CAME' | 'ABSENT' | 'EXCUSED', rating: number | null) {
    return auth(request(createApp()).post('/api/v1/attendance')).send({
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
    });
  }

  async function cleanup() {
    await prisma.billingRun.deleteMany({
      where: { mode: 'DAILY', periodKey: '2026-07-10' },
    });
    await prisma.auditLog.deleteMany({
      where: { actorUserId: adminId, entity: { startsWith: 'FINANCE_' } },
    });
    const entries = await prisma.ledgerEntry.findMany({
      where: { createdByUserId: adminId },
      select: { id: true },
    });
    await prisma.ledgerEntry.deleteMany({
      where: { reversalOfId: { in: entries.map(({ id }) => id) } },
    });
    await prisma.ledgerEntry.deleteMany({
      where: { createdByUserId: adminId },
    });
    await prisma.attendance.deleteMany({
      where: { group: { name: 'Daily Billing Integration Group' } },
    });
    await prisma.groupStudent.deleteMany({
      where: { group: { name: 'Daily Billing Integration Group' } },
    });
    await prisma.student.deleteMany({
      where: { firstName: 'Daily Billing' },
    });
    await prisma.group.deleteMany({
      where: { name: 'Daily Billing Integration Group' },
    });
    await prisma.teacher.deleteMany({
      where: { phone: '+998900006001' },
    });
    await prisma.course.deleteMany({
      where: { title: 'Daily Billing Integration Course' },
    });
    await prisma.user.deleteMany({ where: { id: adminId } });
  }
});

function auth(test: request.Test): request.Test {
  return test.set('Authorization', `Bearer ${token}`);
}
