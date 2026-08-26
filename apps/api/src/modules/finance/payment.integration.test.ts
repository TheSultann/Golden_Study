import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../app.js';
import { prisma } from '../../config/prisma.js';
import { hashPassword } from '../auth/password.service.js';
import { createAccessToken } from '../auth/token.service.js';

const adminId = '75000000-0000-4000-8000-000000000001';
let token = '';
let studentId = '';
let paymentId = '';

describe('Finance payments and ledger API', () => {
  beforeAll(async () => {
    await cleanupFinanceFixtures();
    const admin = await prisma.user.upsert({
      where: { id: adminId },
      update: { isActive: true },
      create: {
        id: adminId,
        login: 'finance-integration-admin',
        passwordHash: await hashPassword('password123'),
        role: 'SUPER_ADMIN',
      },
    });
    const student = await prisma.student.create({
      data: {
        studentCode: `STFIN${Date.now()}`,
        firstName: 'Finance Integration',
        lastName: 'Student',
      },
    });
    studentId = student.id;
    token = createAccessToken({
      id: admin.id,
      login: admin.login,
      role: 'SUPER_ADMIN',
      teacherId: null,
    });
  });

  afterAll(async () => {
    await cleanupFinanceFixtures();
  });

  async function cleanupFinanceFixtures() {
    await prisma.auditLog.deleteMany({
      where: { actorUserId: adminId, entity: { startsWith: 'FINANCE_' } },
    });
    await prisma.payment.deleteMany({ where: { createdByUserId: adminId } });
    const scopedEntries = await prisma.ledgerEntry.findMany({
      where: { createdByUserId: adminId },
      select: { id: true },
    });
    const scopedIds = scopedEntries.map(({ id }) => id);
    await prisma.ledgerEntry.deleteMany({
      where: { reversalOfId: { in: scopedIds } },
    });
    await prisma.ledgerEntry.deleteMany({
      where: { createdByUserId: adminId },
    });
    await prisma.student.deleteMany({
      where: { firstName: 'Finance Integration' },
    });
    await prisma.user.deleteMany({ where: { id: adminId } });
  }

  it('creates payment once for repeated idempotency key', async () => {
    const input = {
      studentId,
      amountUzs: 500000,
      method: 'CASH',
      comment: 'July',
      idempotencyKey: 'finance-test-payment-1',
    };
    const first = await auth(
      request(createApp()).post('/api/v1/payments/student'),
    ).send(input);
    expect(first.status).toBe(201);
    paymentId = (first.body as { data: { id: string } }).data.id;

    const repeated = await auth(
      request(createApp()).post('/api/v1/payments/student'),
    ).send(input);
    expect(repeated.status).toBe(200);
    expect((repeated.body as { data: { id: string } }).data.id).toBe(paymentId);
    expect(
      await prisma.ledgerEntry.count({
        where: { operationKey: 'payment:finance-test-payment-1' },
      }),
    ).toBe(1);
  });

  it('lists student ledger and computes payment as credit', async () => {
    const response = await auth(
      request(createApp()).get(`/api/v1/students/${studentId}/transactions`),
    );
    expect(response.status).toBe(200);
    expect(
      (response.body as { data: Array<{ direction: string; amountUzs: number }> })
        .data,
    ).toContainEqual(
      expect.objectContaining({ direction: 'CREDIT', amountUzs: 500000 }),
    );
  });

  it('reverses payment once without editing original entry', async () => {
    expect(
      (
        await auth(
          request(createApp()).post(`/api/v1/payments/${paymentId}/reverse`),
        ).send({ comment: 'Cashier error' })
      ).status,
    ).toBe(201);
    expect(
      (
        await auth(
          request(createApp()).post(`/api/v1/payments/${paymentId}/reverse`),
        ).send({ comment: 'Again' })
      ).status,
    ).toBe(409);
    const original = await prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
      include: { ledgerEntry: true },
    });
    expect(original.ledgerEntry.direction).toBe('CREDIT');
    expect(original.ledgerEntry.amountUzs).toBe(500000);
  });

  it('creates and reverses immutable manual center transaction', async () => {
    const created = await auth(
      request(createApp()).post('/api/v1/transactions'),
    ).send({
      direction: 'DEBIT',
      amountUzs: 100000,
      categoryLabel: 'Rent',
      subject: 'Center',
      comment: 'Part',
      idempotencyKey: 'test-manual-1',
    });
    expect(created.status).toBe(201);
    const id = (created.body as { data: { id: string } }).data.id;
    expect(
      (
        await auth(
          request(createApp()).post(`/api/v1/transactions/${id}/reverse`),
        ).send({ comment: 'Correction' })
      ).status,
    ).toBe(201);
    expect(
      await prisma.auditLog.count({
        where: { actorUserId: adminId, entity: { startsWith: 'FINANCE_' } },
      }),
    ).toBeGreaterThanOrEqual(4);
  });
});

function auth(test: request.Test): request.Test {
  return test.set('Authorization', `Bearer ${token}`);
}
