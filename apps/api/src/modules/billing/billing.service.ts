import type {
  BillingRunApi,
  BillingRunListQuery,
} from '@golden-study/contracts';
import type {
  AttendanceStatus,
  Prisma,
  PrismaClient,
} from '@prisma/client';

import { ApiError } from '../../common/errors/api-error.js';
import { attendanceOperationKey } from '../attendance/attendance-policy.js';
import {
  calculateDailyLessonPrice,
  countScheduledLessons,
} from '../finance/finance-calculation.js';
import { createFinanceAudit } from '../finance/ledger.service.js';
import type { KpiService } from '../kpi/kpi.service.js';
import { toPaginationMeta } from '../../common/http/pagination.js';

export class BillingService {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly kpi: KpiService,
  ) {}

  public async reconcileDaily(
    date: string,
    actorUserId: string,
  ): Promise<BillingRunApi> {
    return this.prisma.$transaction(
      async (transaction) => {
        const settings = await transaction.settings.findUnique({
          where: { id: 'singleton' },
          select: { billingMode: true },
        });
        if (settings?.billingMode === 'MONTHLY') {
          throw new ApiError(422, 'BUSINESS_ERROR', 'DAILY billing mode required');
        }
        const run = await transaction.billingRun.upsert({
          where: { mode_periodKey: { mode: 'DAILY', periodKey: date } },
          create: { mode: 'DAILY', periodKey: date },
          update: {
            status: 'RUNNING',
            processed: 0,
            createdCount: 0,
            skippedCount: 0,
            errorSummary: null,
            startedAt: new Date(),
            completedAt: null,
          },
        });
        const attendance = await transaction.attendance.findMany({
          where: {
            date: new Date(`${date}T00:00:00.000Z`),
            isReversed: false,
          },
        });
        let createdCount = 0;
        for (const item of attendance) {
          const before = await transaction.ledgerEntry.count({
            where: { sourceType: 'ATTENDANCE', sourceId: item.id },
          });
          await this.reconcileAttendance(transaction, item, actorUserId);
          const after = await transaction.ledgerEntry.count({
            where: { sourceType: 'ATTENDANCE', sourceId: item.id },
          });
          if (after > before) createdCount += 1;
        }
        const completed = await transaction.billingRun.update({
          where: { id: run.id },
          data: {
            status: 'COMPLETED',
            processed: attendance.length,
            createdCount,
            skippedCount: attendance.length - createdCount,
            completedAt: new Date(),
          },
        });
        await transaction.auditLog.create({
          data: {
            actorUserId,
            action: 'RECONCILE',
            entity: 'FINANCE_BILLING_RUN',
            entityId: completed.id,
            after: { date, processed: attendance.length, createdCount },
          },
        });
        return billingRunToApi(completed);
      },
      { isolationLevel: 'Serializable', timeout: 30_000 },
    );
  }

  public async listRuns(query: BillingRunListQuery) {
    const where: Prisma.BillingRunWhereInput = {
      ...(query.mode ? { mode: query.mode } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.billingRun.findMany({
        where,
        orderBy: { [query.sortBy]: query.sortOrder },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.billingRun.count({ where }),
    ]);
    return {
      data: rows.map(billingRunToApi),
      meta: toPaginationMeta(query.page, query.limit, total),
    };
  }

  public async reconcileAttendance(
    transaction: Prisma.TransactionClient,
    attendance: {
      id: string;
      groupId: string;
      studentId: string;
      date: Date;
      status: AttendanceStatus;
    },
    actorUserId: string,
  ): Promise<void> {
    const settings = await transaction.settings.findUnique({
      where: { id: 'singleton' },
      select: { billingMode: true },
    });
    if (settings?.billingMode === 'MONTHLY') return;

    const operationKey = attendanceOperationKey(attendance.id);
    const debitEntries = await transaction.ledgerEntry.findMany({
      where: {
        sourceType: 'ATTENDANCE',
        sourceId: attendance.id,
        direction: 'DEBIT',
      },
      include: { reversedBy: true },
      orderBy: { createdAt: 'asc' },
    });

    const activeEntry = debitEntries.find((entry) => !entry.reversedBy);
    const chargeable =
      attendance.status === 'CAME' || attendance.status === 'ABSENT';

    if (!chargeable) {
      if (activeEntry) {
        await this.createReversal(
          transaction,
          activeEntry,
          actorUserId,
          `Attendance ${attendance.status}`,
        );
      }
      return;
    }

    if (activeEntry) return;

    const group = await transaction.group.findUnique({
      where: { id: attendance.groupId },
      include: { course: true },
    });
    if (!group) throw new ApiError(404, 'NOT_FOUND', 'Group not found');
    const date = attendance.date.toISOString().slice(0, 10);
    const yearMonth = date.slice(0, 7);
    const lessonCount = countScheduledLessons(
      yearMonth,
      group.weekdays,
      group.startDate.toISOString().slice(0, 10),
      group.endDate?.toISOString().slice(0, 10) ?? null,
    );
    if (lessonCount === 0) {
      throw new ApiError(
        422,
        'BUSINESS_ERROR',
        'Scheduled lessons must be positive',
      );
    }
    const amountUzs = calculateDailyLessonPrice(
      group.course.pricePerMonthUzs,
      lessonCount,
    );
    const key = debitEntries.length > 0
      ? `${operationKey}:restore:${debitEntries.length}`
      : operationKey;
    const entry = await transaction.ledgerEntry.create({
      data: {
        accountType: 'STUDENT',
        studentId: attendance.studentId,
        direction: 'DEBIT',
        category: debitEntries.length > 0 ? 'ADJUSTMENT' : 'DAILY_LESSON_CHARGE',
        amountUzs,
        operationKey: key,
        sourceType: 'ATTENDANCE',
        sourceId: attendance.id,
        comment: `Attendance ${attendance.status} ${date}`,
        createdByUserId: actorUserId,
      },
    });
    await createFinanceAudit(
      transaction,
      actorUserId,
      'FINANCE_DAILY_BILLING',
      attendance.id,
      debitEntries.length > 0 ? 'RESTORE' : 'CHARGE',
      entry,
    );
    await this.kpi.applyPercentForCharge(
      transaction,
      entry,
      group.teacherId,
      actorUserId,
    );
  }

  public async reverseAttendance(
    transaction: Prisma.TransactionClient,
    attendanceId: string,
    actorUserId: string,
  ): Promise<void> {
    const entries = await transaction.ledgerEntry.findMany({
      where: {
        sourceType: 'ATTENDANCE',
        sourceId: attendanceId,
        direction: 'DEBIT',
      },
      include: { reversedBy: true },
      orderBy: { createdAt: 'desc' },
    });
    for (const entry of entries) {
      if (!entry.reversedBy) {
        await this.createReversal(
          transaction,
          entry,
          actorUserId,
          'Attendance reversed',
        );
      }
    }
  }

  private async createReversal(
    transaction: Prisma.TransactionClient,
    original: {
      id: string;
      accountType: 'STUDENT' | 'TEACHER' | 'CENTER';
      studentId: string | null;
      teacherId: string | null;
      amountUzs: number;
    },
    actorUserId: string,
    comment: string,
  ): Promise<void> {
    const reversal = await transaction.ledgerEntry.create({
      data: {
        accountType: original.accountType,
        studentId: original.studentId,
        teacherId: original.teacherId,
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
    await createFinanceAudit(
      transaction,
      actorUserId,
      'FINANCE_DAILY_BILLING',
      original.id,
      'REVERSE',
      reversal,
    );
    await this.kpi.reverseForCharge(transaction, original.id, actorUserId);
  }
}

function billingRunToApi(row: {
  id: string;
  mode: 'DAILY' | 'MONTHLY';
  periodKey: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  processed: number;
  createdCount: number;
  skippedCount: number;
  errorSummary: string | null;
  startedAt: Date;
  completedAt: Date | null;
}): BillingRunApi {
  return {
    ...row,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}
