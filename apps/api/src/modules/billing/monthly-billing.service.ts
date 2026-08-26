import type { BillingRunApi } from '@golden-study/contracts';
import type { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { ApiError } from '../../common/errors/api-error.js';
import {
  calculateMonthlyCharge,
  countActiveScheduledLessons,
  countScheduledLessons,
  monthlyChargeOperationKey,
} from '../finance/finance-calculation.js';
import { createFinanceAudit } from '../finance/ledger.service.js';
import type { KpiService } from '../kpi/kpi.service.js';

export class MonthlyBillingService {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly kpi: KpiService,
  ) {}

  public async reconcile(
    period: string,
    actorUserId: string,
  ): Promise<BillingRunApi> {
    return this.prisma.$transaction(
      async (transaction) => {
        const settings = await transaction.settings.findUnique({
          where: { id: 'singleton' },
        });
        if (settings?.billingMode !== 'MONTHLY') {
          throw new ApiError(
            422,
            'BUSINESS_ERROR',
            'MONTHLY billing mode required',
          );
        }
        const { monthStart, nextMonth } = monthBounds(period);
        const run = await transaction.billingRun.upsert({
          where: { mode_periodKey: { mode: 'MONTHLY', periodKey: period } },
          create: { mode: 'MONTHLY', periodKey: period },
          update: {
            status: 'RUNNING',
            processed: 0,
            createdCount: 0,
            skippedCount: 0,
            errorSummary: null,
            completedAt: null,
            startedAt: new Date(),
          },
        });
        const groups = await transaction.group.findMany({
          where: {
            startDate: { lt: nextMonth },
            OR: [{ endDate: null }, { endDate: { gte: monthStart } }],
          },
          include: {
            course: true,
            teacher: true,
            students: {
              where: {
                joinedAt: { lt: nextMonth },
                OR: [{ leftAt: null }, { leftAt: { gte: monthStart } }],
              },
              include: {
                student: {
                  include: {
                    statusPeriods: {
                      where: {
                        startedAt: { lt: nextMonth },
                        OR: [
                          { endedAt: null },
                          { endedAt: { gte: monthStart } },
                        ],
                      },
                    },
                  },
                },
              },
            },
          },
        });
        let processed = 0;
        let createdCount = 0;
        let skippedCount = 0;
        for (const group of groups) {
          const groupStart = formatDate(group.startDate);
          const groupEnd = group.endDate ? formatDate(group.endDate) : null;
          const totalLessons = countScheduledLessons(
            period,
            group.weekdays,
            groupStart,
            groupEnd,
          );
          if (totalLessons === 0) {
            skippedCount += group.students.length;
            continue;
          }
          for (const membership of group.students) {
            processed += 1;
            const periods =
              membership.student.statusPeriods.length > 0
                ? membership.student.statusPeriods
                : membership.student.status === 'ACTIVE'
                  ? [
                      {
                        status: 'ACTIVE' as const,
                        startedAt: membership.joinedAt,
                        endedAt: membership.leftAt,
                      },
                    ]
                  : [];
            const activeLessons = countActiveScheduledLessons(
              period,
              group.weekdays,
              groupStart,
              groupEnd,
              membership.joinedAt,
              membership.leftAt,
              periods,
            );
            if (activeLessons === 0) {
              skippedCount += 1;
              continue;
            }
            await this.kpi.applyMonthlyPerStudent(
              transaction,
              group.teacher,
              period,
              group.id,
              membership.studentId,
              activeLessons,
              totalLessons,
              actorUserId,
            );
            const expected = calculateMonthlyCharge(
              group.course.pricePerMonthUzs,
              activeLessons,
              totalLessons,
            );
            const baseKey = monthlyChargeOperationKey(
              period,
              group.id,
              membership.studentId,
            );
            const entries = await transaction.ledgerEntry.findMany({
              where: {
                sourceType: 'MONTHLY_BILLING',
                sourceId: baseKey,
              },
              include: { reversedBy: true },
            });
            const current = entries.reduce(
              (sum, entry) =>
                entry.reversedBy
                  ? sum
                  : sum +
                    (entry.direction === 'DEBIT'
                      ? entry.amountUzs
                      : -entry.amountUzs),
              0,
            );
            const delta = expected - current;
            if (delta === 0) continue;
            const entry = await transaction.ledgerEntry.create({
              data: {
                accountType: 'STUDENT',
                studentId: membership.studentId,
                direction: delta > 0 ? 'DEBIT' : 'CREDIT',
                category:
                  entries.length === 0
                    ? 'MONTHLY_TUITION_CHARGE'
                    : 'ADJUSTMENT',
                amountUzs: Math.abs(delta),
                operationKey:
                  entries.length === 0
                    ? baseKey
                    : `${baseKey}:adjust:${randomUUID()}`,
                sourceType: 'MONTHLY_BILLING',
                sourceId: baseKey,
                comment: `Monthly tuition ${period}`,
                createdByUserId: actorUserId,
              },
            });
            createdCount += 1;
            await createFinanceAudit(
              transaction,
              actorUserId,
              'FINANCE_MONTHLY_BILLING',
              membership.studentId,
              entries.length === 0 ? 'CHARGE' : 'ADJUST',
              entry,
            );
            await this.kpi.applyPercentForCharge(
              transaction,
              entry,
              group.teacherId,
              actorUserId,
            );
          }
        }
        for (const teacher of new Map(
          groups.map((group) => [group.teacher.id, group.teacher]),
        ).values()) {
          await this.kpi.applyMonthlyFixed(
            transaction,
            teacher,
            period,
            actorUserId,
          );
        }
        const completed = await transaction.billingRun.update({
          where: { id: run.id },
          data: {
            status: 'COMPLETED',
            processed,
            createdCount,
            skippedCount,
            completedAt: new Date(),
          },
        });
        await transaction.auditLog.create({
          data: {
            actorUserId,
            action: 'RECONCILE',
            entity: 'FINANCE_BILLING_RUN',
            entityId: completed.id,
            after: { period, processed, createdCount, skippedCount },
          },
        });
        return toApi(completed);
      },
      { isolationLevel: 'Serializable', timeout: 30_000 },
    );
  }
}

function monthBounds(period: string) {
  const [year, month] = period.split('-').map(Number);
  const monthStart = new Date(Date.UTC(year!, month! - 1, 1));
  const nextMonth = new Date(Date.UTC(year!, month, 1));
  return { monthStart, nextMonth };
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toApi(row: {
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
