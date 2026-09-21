import type {
  LedgerEntryApi,
  TeacherKpiSummaryApi,
  TeacherPayoutInput,
} from '@golden-study/contracts';
import type { Prisma, PrismaClient, Teacher } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { ApiError } from '../../common/errors/api-error.js';
import { calculateMonthlyCharge, calculatePercentKpi } from '../finance/finance-calculation.js';
import { createFinanceAudit, toLedgerApi } from '../finance/ledger.service.js';

type Charge = {
  id: string;
  operationKey: string;
  direction: 'CREDIT' | 'DEBIT';
  amountUzs: number;
};

export class KpiService {
  public constructor(private readonly prisma: PrismaClient) {}

  public async applyPercentForCharge(
    transaction: Prisma.TransactionClient,
    charge: Charge,
    teacherId: string,
    actorUserId: string,
  ): Promise<void> {
    const teacher = await transaction.teacher.findUnique({ where: { id: teacherId } });
    if (!teacher || teacher.salaryType !== 'PERCENT') return;
    const amountUzs = calculatePercentKpi(
      charge.amountUzs,
      teacher.kpiRateBasisPoints ?? 0,
    );
    if (amountUzs <= 0) return;
    const entry = await transaction.ledgerEntry.upsert({
      where: { operationKey: `${charge.operationKey}:kpi:percent:v1` },
      create: {
        accountType: 'TEACHER',
        teacherId,
        direction: charge.direction === 'DEBIT' ? 'CREDIT' : 'DEBIT',
        category: 'KPI_PERCENT_ACCRUAL',
        amountUzs,
        operationKey: `${charge.operationKey}:kpi:percent:v1`,
        sourceType: 'KPI',
        sourceId: charge.id,
        comment: 'Percent KPI accrual',
        createdByUserId: actorUserId,
      },
      update: {},
    });
    await createFinanceAudit(
      transaction,
      actorUserId,
      'FINANCE_KPI',
      teacherId,
      'ACCRUE_PERCENT',
      entry,
    );
  }

  public async reverseForCharge(
    transaction: Prisma.TransactionClient,
    chargeId: string,
    actorUserId: string,
  ): Promise<void> {
    const original = await transaction.ledgerEntry.findFirst({
      where: { sourceType: 'KPI', sourceId: chargeId },
      include: { reversedBy: true },
    });
    if (!original || original.reversedBy) return;
    const reversal = await transaction.ledgerEntry.create({
      data: {
        accountType: 'TEACHER',
        teacherId: original.teacherId,
        direction: original.direction === 'CREDIT' ? 'DEBIT' : 'CREDIT',
        category: 'REVERSAL',
        amountUzs: original.amountUzs,
        operationKey: `ledger:${original.id}:reversal:v1`,
        sourceType: 'REVERSAL',
        sourceId: original.id,
        reversalOfId: original.id,
        comment: 'KPI source charge reversed',
        createdByUserId: actorUserId,
      },
    });
    await createFinanceAudit(
      transaction,
      actorUserId,
      'FINANCE_KPI',
      original.id,
      'REVERSE',
      reversal,
    );
  }

  public async applyMonthlyPerStudent(
    transaction: Prisma.TransactionClient,
    teacher: Teacher,
    period: string,
    groupId: string,
    studentId: string,
    activeLessons: number,
    totalLessons: number,
    actorUserId: string,
  ): Promise<void> {
    if (teacher.salaryType !== 'PER_STUDENT') return;
    const amountUzs = calculateMonthlyCharge(
      teacher.perStudentRateUzs ?? 0,
      activeLessons,
      totalLessons,
    );
    if (amountUzs <= 0) return;
    await transaction.ledgerEntry.upsert({
      where: {
        operationKey: `kpi:${period}:teacher:${teacher.id}:group:${groupId}:student:${studentId}:v1`,
      },
      create: {
        accountType: 'TEACHER',
        teacherId: teacher.id,
        direction: 'CREDIT',
        category: 'KPI_PER_STUDENT_ACCRUAL',
        amountUzs,
        operationKey: `kpi:${period}:teacher:${teacher.id}:group:${groupId}:student:${studentId}:v1`,
        sourceType: 'KPI',
        sourceId: studentId,
        comment: `Per-student KPI ${period}`,
        createdByUserId: actorUserId,
      },
      update: {},
    });
  }

  public async applyMonthlyFixed(
    transaction: Prisma.TransactionClient,
    teacher: Teacher,
    period: string,
    actorUserId: string,
  ): Promise<void> {
    if (teacher.salaryType !== 'FIXED' || !teacher.fixedSalaryUzs) return;
    await transaction.ledgerEntry.upsert({
      where: { operationKey: `kpi:${period}:teacher:${teacher.id}:fixed:v1` },
      create: {
        accountType: 'TEACHER',
        teacherId: teacher.id,
        direction: 'CREDIT',
        category: 'KPI_FIXED_ACCRUAL',
        amountUzs: teacher.fixedSalaryUzs,
        operationKey: `kpi:${period}:teacher:${teacher.id}:fixed:v1`,
        sourceType: 'KPI',
        sourceId: teacher.id,
        comment: `Fixed KPI ${period}`,
        createdByUserId: actorUserId,
      },
      update: {},
    });
  }

  public async summary(teacherId: string): Promise<TeacherKpiSummaryApi> {
    const teacher = await this.prisma.teacher.findUnique({ where: { id: teacherId } });
    if (!teacher) throw new ApiError(404, 'NOT_FOUND', 'Teacher not found');
    const entries = await this.prisma.ledgerEntry.findMany({
      where: { accountType: 'TEACHER', teacherId },
      select: { direction: true, amountUzs: true },
    });
    return summarize(teacherId, entries);
  }

  public async payout(
    teacherId: string,
    input: TeacherPayoutInput,
    actorUserId: string,
  ): Promise<{ data: LedgerEntryApi; created: boolean }> {
    const operationKey = `payout:${input.idempotencyKey ?? randomUUID()}`;
    return this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.ledgerEntry.findUnique({ where: { operationKey } });
      if (existing) return { data: toLedgerApi(existing), created: false };
      const teacher = await transaction.teacher.findUnique({ where: { id: teacherId } });
      if (!teacher) throw new ApiError(404, 'NOT_FOUND', 'Teacher not found');
      const entries = await transaction.ledgerEntry.findMany({
        where: { accountType: 'TEACHER', teacherId },
        select: { direction: true, amountUzs: true },
      });
      if (input.amountUzs > summarize(teacherId, entries).payableUzs) {
        throw new ApiError(422, 'BUSINESS_ERROR', 'Payout exceeds payable amount');
      }
      const entry = await transaction.ledgerEntry.create({
        data: {
          accountType: 'TEACHER',
          teacherId,
          direction: 'DEBIT',
          category: 'TEACHER_PAYOUT',
          amountUzs: input.amountUzs,
          operationKey,
          sourceType: 'PAYOUT',
          sourceId: teacherId,
          comment: input.comment,
          createdByUserId: actorUserId,
        },
      });

      await transaction.user.updateMany({
        where: { teacherId },
        data: { lastSalaryPaidAt: new Date() },
      });

      await createFinanceAudit(transaction, actorUserId, 'FINANCE_PAYOUT', entry.id, 'CREATE', entry);
      return { data: toLedgerApi(entry), created: true };
    }, { isolationLevel: 'Serializable' });
  }

  public async reversePayout(
    teacherId: string,
    payoutId: string,
    comment: string,
    actorUserId: string,
  ): Promise<LedgerEntryApi> {
    return this.prisma.$transaction(async (transaction) => {
      const original = await transaction.ledgerEntry.findUnique({
        where: { id: payoutId },
        include: { reversedBy: true },
      });
      if (!original || original.teacherId !== teacherId || original.category !== 'TEACHER_PAYOUT') {
        throw new ApiError(404, 'NOT_FOUND', 'Payout not found');
      }
      if (original.reversedBy) throw new ApiError(409, 'CONFLICT', 'Payout already reversed');
      const reversal = await transaction.ledgerEntry.create({
        data: {
          accountType: 'TEACHER',
          teacherId,
          direction: 'CREDIT',
          category: 'REVERSAL',
          amountUzs: original.amountUzs,
          operationKey: `ledger:${original.id}:reversal:v1`,
          sourceType: 'REVERSAL',
          sourceId: original.id,
          reversalOfId: original.id,
          comment,
          createdByUserId: actorUserId,
        },
      });
      await createFinanceAudit(transaction, actorUserId, 'FINANCE_PAYOUT', original.id, 'REVERSE', reversal);
      return toLedgerApi(reversal);
    });
  }
}

function summarize(
  teacherId: string,
  entries: ReadonlyArray<{ direction: 'CREDIT' | 'DEBIT'; amountUzs: number }>,
): TeacherKpiSummaryApi {
  const creditsUzs = entries.reduce(
    (sum, entry) => sum + (entry.direction === 'CREDIT' ? entry.amountUzs : 0),
    0,
  );
  const debitsUzs = entries.reduce(
    (sum, entry) => sum + (entry.direction === 'DEBIT' ? entry.amountUzs : 0),
    0,
  );
  return { teacherId, creditsUzs, debitsUzs, payableUzs: creditsUzs - debitsUzs };
}
