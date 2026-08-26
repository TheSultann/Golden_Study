import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../app.js';
import { prisma } from '../../config/prisma.js';
import { hashPassword } from '../auth/password.service.js';
import { createAccessToken } from '../auth/token.service.js';

const adminId = '77000000-0000-4000-8000-000000000001';
const period = '2026-07';
let token = '';
let studentId = '';
let groupId = '';
let teacherId = '';

describe('MONTHLY billing reconciliation', () => {
  beforeAll(async () => {
    await cleanup();
    const admin = await prisma.user.create({
      data: {
        id: adminId,
        login: 'monthly-billing-admin',
        passwordHash: await hashPassword('password123'),
        role: 'SUPER_ADMIN',
      },
    });
    await prisma.settings.upsert({
      where: { id: 'singleton' },
      update: { billingMode: 'MONTHLY' },
      create: {
        id: 'singleton',
        centerName: 'Golden Study',
        billingMode: 'MONTHLY',
      },
    });
    const course = await prisma.course.create({
      data: {
        title: 'Monthly Billing Integration Course',
        durationMonths: 6,
        pricePerMonthUzs: 1_200_000,
      },
    });
    const teacher = await prisma.teacher.create({
      data: {
        firstName: 'Monthly Billing',
        lastName: 'Teacher',
        phone: '+998900007001',
        salaryType: 'FIXED',
        fixedSalaryUzs: 4_000_000,
      },
    });
    teacherId = teacher.id;
    const group = await prisma.group.create({
      data: {
        name: 'Monthly Billing Integration Group',
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
        studentCode: `STMB${Date.now()}`,
        firstName: 'Monthly Billing',
        lastName: 'Student',
        groups: {
          create: {
            groupId: group.id,
            joinedAt: new Date('2026-07-15T00:00:00.000Z'),
          },
        },
        statusPeriods: {
          create: [
            {
              status: 'ACTIVE',
              startedAt: new Date('2026-07-15T00:00:00.000Z'),
              endedAt: new Date('2026-07-21T00:00:00.000Z'),
            },
            {
              status: 'FROZEN',
              startedAt: new Date('2026-07-21T00:00:00.000Z'),
            },
          ],
        },
      },
    });
    studentId = student.id;
    groupId = group.id;
    token = createAccessToken({
      id: admin.id,
      login: admin.login,
      role: 'SUPER_ADMIN',
      teacherId: null,
    });
  });

  afterAll(cleanup);

  it('prorates active scheduled days and repeated run is a no-op', async () => {
    const first = await auth(
      request(createApp()).post('/api/v1/billing/monthly/reconcile'),
    ).send({ period });
    expect(first.status).toBe(200);
    expect((first.body as { data: unknown }).data).toMatchObject({
      mode: 'MONTHLY',
      periodKey: period,
      status: 'COMPLETED',
      createdCount: 1,
    });

    const operationKey =
      `monthly:${period}:group:${groupId}:student:${studentId}:charge:v1`;
    expect(
      await prisma.ledgerEntry.findUnique({ where: { operationKey } }),
    ).toMatchObject({
      direction: 'DEBIT',
      category: 'MONTHLY_TUITION_CHARGE',
      amountUzs: 257143,
    });
    expect(
      await prisma.ledgerEntry.findFirst({
        where: {
          category: 'KPI_FIXED_ACCRUAL',
          teacherId,
          operationKey: { contains: period },
        },
      }),
    ).toMatchObject({
      direction: 'CREDIT',
      amountUzs: 4_000_000,
    });

    const repeated = await auth(
      request(createApp()).post('/api/v1/billing/monthly/reconcile'),
    ).send({ period });
    expect(repeated.status).toBe(200);
    expect(
      await prisma.ledgerEntry.count({
        where: { sourceType: 'MONTHLY_BILLING', sourceId: operationKey },
      }),
    ).toBe(1);
  });

  async function cleanup() {
    await prisma.auditLog.deleteMany({ where: { actorUserId: adminId } });
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
    await prisma.billingRun.deleteMany({
      where: { mode: 'MONTHLY', periodKey: period },
    });
    await prisma.studentStatusPeriod.deleteMany({
      where: { student: { firstName: 'Monthly Billing' } },
    });
    await prisma.groupStudent.deleteMany({
      where: { group: { name: 'Monthly Billing Integration Group' } },
    });
    await prisma.student.deleteMany({
      where: { firstName: 'Monthly Billing' },
    });
    await prisma.group.deleteMany({
      where: { name: 'Monthly Billing Integration Group' },
    });
    await prisma.teacher.deleteMany({
      where: { phone: '+998900007001' },
    });
    await prisma.course.deleteMany({
      where: { title: 'Monthly Billing Integration Course' },
    });
    await prisma.user.deleteMany({ where: { id: adminId } });
  }
});

function auth(test: request.Test): request.Test {
  return test.set('Authorization', `Bearer ${token}`);
}
