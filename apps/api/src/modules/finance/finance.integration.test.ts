import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../app.js';
import { prisma } from '../../config/prisma.js';
import { hashPassword } from '../auth/password.service.js';
import { createAccessToken } from '../auth/token.service.js';

const adminId = '79000000-0000-4000-8000-000000000001';
let token = '';
let studentId = '';
let teacherId = '';

describe('Finance projections API', () => {
  beforeAll(async () => {
    await cleanup();
    const admin = await prisma.user.create({
      data: {
        id: adminId,
        login: 'finance-query-admin',
        passwordHash: await hashPassword('password123'),
        role: 'SUPER_ADMIN',
      },
    });
    const student = await prisma.student.create({
      data: {
        studentCode: `STFQ${Date.now()}`,
        firstName: 'Finance Query',
        lastName: 'Debtor',
      },
    });
    const creditStudent = await prisma.student.create({
      data: {
        studentCode: `STFQC${Date.now()}`,
        firstName: 'Finance Query',
        lastName: 'Creditor',
      },
    });
    const teacher = await prisma.teacher.create({
      data: {
        firstName: 'Finance Query',
        lastName: 'Teacher',
        phone: '+998900009001',
        salaryType: 'FIXED',
        fixedSalaryUzs: 400_000,
      },
    });
    studentId = student.id;
    teacherId = teacher.id;
    await prisma.ledgerEntry.createMany({
      data: [
        entry('fq-payment', 'STUDENT', 'CREDIT', 'STUDENT_PAYMENT', 500_000, {
          studentId,
        }),
        entry('fq-charge', 'STUDENT', 'DEBIT', 'MONTHLY_TUITION_CHARGE', 800_000, {
          studentId,
        }),
        entry('fq-credit-balance', 'STUDENT', 'CREDIT', 'STUDENT_PAYMENT', 1_000_000, {
          studentId: creditStudent.id,
        }),
        entry('fq-kpi', 'TEACHER', 'CREDIT', 'KPI_FIXED_ACCRUAL', 400_000, {
          teacherId,
        }),
        entry('fq-payout', 'TEACHER', 'DEBIT', 'TEACHER_PAYOUT', 100_000, {
          teacherId,
        }),
        entry('fq-income', 'CENTER', 'CREDIT', 'MANUAL_INCOME', 200_000),
        entry('fq-expense', 'CENTER', 'DEBIT', 'MANUAL_EXPENSE', 50_000),
      ],
    });
    token = createAccessToken({
      id: admin.id,
      login: admin.login,
      role: 'SUPER_ADMIN',
      teacherId: null,
    });
  });

  afterAll(cleanup);

  it('computes summary only from immutable ledger', async () => {
    const response = await auth(
      request(createApp()).get('/api/v1/finance/summary'),
    );
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      data: {
        incomeUzs: 1_700_000,
        expenseUzs: 150_000,
        netCashflowUzs: 1_550_000,
        studentDebtUzs: 300_000,
        teacherPayableUzs: 300_000,
      },
    });
  });

  it('returns paginated students with negative computed balance', async () => {
    const response = await auth(
      request(createApp()).get('/api/v1/finance/debtors?page=1&limit=10'),
    );
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      data: [{
        studentId,
        studentName: 'Finance Query Debtor',
        balanceUzs: -300_000,
        debtUzs: 300_000,
      }],
      meta: { page: 1, limit: 10, total: 1 },
    });
  });
});

function entry(
  operationKey: string,
  accountType: 'STUDENT' | 'TEACHER' | 'CENTER',
  direction: 'CREDIT' | 'DEBIT',
  category:
    | 'STUDENT_PAYMENT'
    | 'MONTHLY_TUITION_CHARGE'
    | 'KPI_FIXED_ACCRUAL'
    | 'TEACHER_PAYOUT'
    | 'MANUAL_INCOME'
    | 'MANUAL_EXPENSE',
  amountUzs: number,
  owner: { studentId?: string; teacherId?: string } = {},
) {
  return {
    accountType,
    direction,
    category,
    amountUzs,
    operationKey,
    sourceType: 'MANUAL' as const,
    sourceId: operationKey,
    createdByUserId: adminId,
    ...owner,
  };
}

async function cleanup() {
  await prisma.auditLog.deleteMany({ where: { actorUserId: adminId } });
  await prisma.ledgerEntry.deleteMany({ where: { createdByUserId: adminId } });
  await prisma.studentStatusPeriod.deleteMany({
    where: { student: { firstName: 'Finance Query' } },
  });
  await prisma.student.deleteMany({ where: { firstName: 'Finance Query' } });
  await prisma.teacher.deleteMany({ where: { phone: '+998900009001' } });
  await prisma.user.deleteMany({ where: { id: adminId } });
}

function auth(test: request.Test): request.Test {
  return test.set('Authorization', `Bearer ${token}`);
}
