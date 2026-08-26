import type {
  LedgerEntryApi,
  ManualTransactionCreateInput,
  TransactionListQuery,
} from '@golden-study/contracts';
import type { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { ApiError } from '../../common/errors/api-error.js';
import { toPaginationMeta } from '../../common/http/pagination.js';

export class LedgerService {
  public constructor(private readonly prisma: PrismaClient) {}

  public async list(query: TransactionListQuery) {
    const { from, to } = dateRange(query.dateFrom, query.dateTo);
    const where: Prisma.LedgerEntryWhereInput = {
      ...(query.accountType ? { accountType: query.accountType } : {}),
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.teacherId ? { teacherId: query.teacherId } : {}),
      ...(query.direction ? { direction: query.direction } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lt: to } : {}),
            },
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.ledgerEntry.findMany({
        where,
        orderBy: { [query.sortBy]: query.sortOrder },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.ledgerEntry.count({ where }),
    ]);
    return {
      data: rows.map(toLedgerApi),
      meta: toPaginationMeta(query.page, query.limit, total),
    };
  }

  public async createManual(
    input: ManualTransactionCreateInput,
    actorUserId: string,
  ): Promise<{ data: LedgerEntryApi; created: boolean }> {
    const operationKey = `manual:${input.idempotencyKey ?? randomUUID()}`;
    const existing = await this.prisma.ledgerEntry.findUnique({
      where: { operationKey },
    });
    if (existing) return { data: toLedgerApi(existing), created: false };
    try {
      const row = await this.prisma.$transaction(async (transaction) => {
        const entry = await transaction.ledgerEntry.create({
          data: {
            accountType: 'CENTER',
            direction: input.direction,
            category:
              input.direction === 'CREDIT'
                ? 'MANUAL_INCOME'
                : 'MANUAL_EXPENSE',
            amountUzs: input.amountUzs,
            operationKey,
            sourceType: 'MANUAL',
            sourceId: input.subject,
            comment: `${input.categoryLabel}: ${input.comment}`.trim(),
            createdByUserId: actorUserId,
          },
        });
        await createFinanceAudit(
          transaction,
          actorUserId,
          'FINANCE_MANUAL',
          entry.id,
          'CREATE',
          entry,
        );
        return entry;
      });
      return { data: toLedgerApi(row), created: true };
    } catch (error) {
      if (isPrismaCode(error, 'P2002')) {
        const row = await this.prisma.ledgerEntry.findUniqueOrThrow({
          where: { operationKey },
        });
        return { data: toLedgerApi(row), created: false };
      }
      throw error;
    }
  }

  public async reverse(
    id: string,
    comment: string,
    actorUserId: string,
  ): Promise<LedgerEntryApi> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const original = await transaction.ledgerEntry.findUnique({
          where: { id },
          include: { reversedBy: true },
        });
        if (!original) {
          throw new ApiError(404, 'NOT_FOUND', 'Ledger entry not found');
        }
        if (original.reversalOfId || original.reversedBy) {
          throw new ApiError(409, 'CONFLICT', 'Ledger entry already reversed');
        }
        const reversal = await transaction.ledgerEntry.create({
          data: {
            accountType: original.accountType,
            studentId: original.studentId,
            teacherId: original.teacherId,
            direction: original.direction === 'CREDIT' ? 'DEBIT' : 'CREDIT',
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
          'FINANCE_LEDGER',
          original.id,
          'REVERSE',
          reversal,
        );
        return toLedgerApi(reversal);
      });
    } catch (error) {
      if (isPrismaCode(error, 'P2002')) {
        throw new ApiError(409, 'CONFLICT', 'Ledger entry already reversed');
      }
      throw error;
    }
  }
}

export async function createFinanceAudit(
  transaction: Prisma.TransactionClient,
  actorUserId: string,
  entity: string,
  entityId: string,
  action: string,
  after: {
    operationKey?: string;
    amountUzs?: number;
    direction?: string;
    category?: string;
  },
): Promise<void> {
  await transaction.auditLog.create({
    data: {
      actorUserId,
      action,
      entity,
      entityId,
      after: {
        operationKey: after.operationKey,
        amountUzs: after.amountUzs,
        direction: after.direction,
        category: after.category,
      },
    },
  });
}

export function toLedgerApi(row: {
  id: string;
  accountType: 'STUDENT' | 'TEACHER' | 'CENTER';
  studentId: string | null;
  teacherId: string | null;
  direction: 'CREDIT' | 'DEBIT';
  category: LedgerEntryApi['category'];
  amountUzs: number;
  operationKey: string;
  sourceType: LedgerEntryApi['sourceType'];
  sourceId: string | null;
  reversalOfId: string | null;
  comment: string;
  createdAt: Date;
}): LedgerEntryApi {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
  };
}

function dateRange(dateFrom?: string, dateTo?: string) {
  const from = dateFrom
    ? new Date(`${dateFrom}T00:00:00.000Z`)
    : undefined;
  const to = dateTo ? new Date(`${dateTo}T00:00:00.000Z`) : undefined;
  if (to) to.setUTCDate(to.getUTCDate() + 1);
  return { from, to };
}

function isPrismaCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === code
  );
}
