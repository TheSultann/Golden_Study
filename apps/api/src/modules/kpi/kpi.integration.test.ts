import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../app.js';
import { prisma } from '../../config/prisma.js';
import { hashPassword } from '../auth/password.service.js';
import { createAccessToken } from '../auth/token.service.js';

const adminId = '78000000-0000-4000-8000-000000000001';
let token = '';
let teacherId = '';
let payoutId = '';

describe('Teacher KPI payout API', () => {
  beforeAll(async () => {
    await cleanup();
    const admin = await prisma.user.create({
      data: {
        id: adminId,
        login: 'kpi-integration-admin',
        passwordHash: await hashPassword('password123'),
        role: 'SUPER_ADMIN',
      },
    });
    const teacher = await prisma.teacher.create({
      data: {
        firstName: 'KPI Integration',
        lastName: 'Teacher',
        phone: '+998900008001',
        salaryType: 'FIXED',
        fixedSalaryUzs: 4_000_000,
      },
    });
    teacherId = teacher.id;
    await prisma.ledgerEntry.create({
      data: {
        accountType: 'TEACHER',
        teacherId,
        direction: 'CREDIT',
        category: 'KPI_FIXED_ACCRUAL',
        amountUzs: 4_000_000,
        operationKey: 'kpi-integration-accrual',
        sourceType: 'KPI',
        sourceId: teacherId,
        createdByUserId: adminId,
      },
    });
    token = createAccessToken({
      id: admin.id,
      login: admin.login,
      role: 'SUPER_ADMIN',
      teacherId: null,
    });
  });

  afterAll(cleanup);

  it('pays no more than computed payable and reverses payout', async () => {
    const summary = await auth(
      request(createApp()).get(`/api/v1/teachers/${teacherId}/kpi`),
    );
    expect(summary.status).toBe(200);
    expect((summary.body as { data: { payableUzs: number } }).data.payableUzs)
      .toBe(4_000_000);

    const payout = await auth(
      request(createApp()).post(`/api/v1/teachers/${teacherId}/payout`),
    ).send({
      amountUzs: 1_000_000,
      comment: 'Partial July payout',
      idempotencyKey: 'kpi-test-payout-1',
    });
    expect(payout.status).toBe(201);
    payoutId = (payout.body as { data: { id: string } }).data.id;

    expect(
      (
        await auth(
          request(createApp()).post(`/api/v1/teachers/${teacherId}/payout`),
        ).send({
          amountUzs: 4_000_000,
          comment: 'Too much',
          idempotencyKey: 'kpi-test-payout-too-much',
        })
      ).status,
    ).toBe(422);

    expect(
      (
        await auth(
          request(createApp()).post(
            `/api/v1/teachers/${teacherId}/payouts/${payoutId}/reverse`,
          ),
        ).send({ comment: 'Correction' })
      ).status,
    ).toBe(201);
    const after = await auth(
      request(createApp()).get(`/api/v1/teachers/${teacherId}/kpi`),
    );
    expect((after.body as { data: { payableUzs: number } }).data.payableUzs)
      .toBe(4_000_000);
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
    await prisma.ledgerEntry.deleteMany({ where: { createdByUserId: adminId } });
    await prisma.teacher.deleteMany({ where: { phone: '+998900008001' } });
    await prisma.user.deleteMany({ where: { id: adminId } });
  }
});

function auth(test: request.Test): request.Test {
  return test.set('Authorization', `Bearer ${token}`);
}
