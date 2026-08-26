import type {
  DebtorApi,
  DebtorListQuery,
  FinanceSummaryApi,
} from '@golden-study/contracts';
import type { PrismaClient } from '@prisma/client';

import { toPaginationMeta } from '../../common/http/pagination.js';

export class FinanceQueryService {
  public constructor(private readonly prisma: PrismaClient) {}

  public async summary(): Promise<FinanceSummaryApi> {
    const [rows, studentRows, teacherRows] = await Promise.all([
      this.prisma.ledgerEntry.groupBy({
        by: ['direction', 'category'],
        _sum: { amountUzs: true },
      }),
      this.prisma.ledgerEntry.groupBy({
        by: ['studentId', 'direction'],
        where: { accountType: 'STUDENT', studentId: { not: null } },
        _sum: { amountUzs: true },
      }),
      this.prisma.ledgerEntry.groupBy({
        by: ['teacherId', 'direction'],
        where: { accountType: 'TEACHER', teacherId: { not: null } },
        _sum: { amountUzs: true },
      }),
    ]);
    let incomeUzs = 0;
    let expenseUzs = 0;
    for (const row of rows) {
      const amount = row._sum.amountUzs ?? 0;
      if (
        row.direction === 'CREDIT' &&
        (row.category === 'STUDENT_PAYMENT' ||
          row.category === 'MANUAL_INCOME')
      ) {
        incomeUzs += amount;
      }
      if (
        row.direction === 'DEBIT' &&
        (row.category === 'TEACHER_PAYOUT' ||
          row.category === 'MANUAL_EXPENSE')
      ) {
        expenseUzs += amount;
      }
    }
    const studentDebtUzs = negativeOwnerTotal(studentRows, 'studentId');
    const teacherPayableUzs = positiveOwnerTotal(teacherRows, 'teacherId');
    return {
      incomeUzs,
      expenseUzs,
      netCashflowUzs: incomeUzs - expenseUzs,
      studentDebtUzs,
      teacherPayableUzs,
    };
  }

  public async debtors(query: DebtorListQuery) {
    const grouped = await this.prisma.ledgerEntry.groupBy({
      by: ['studentId', 'direction'],
      where: { accountType: 'STUDENT', studentId: { not: null } },
      _sum: { amountUzs: true },
    });
    const balances = new Map<string, number>();
    for (const row of grouped) {
      if (!row.studentId) continue;
      const amount = row._sum.amountUzs ?? 0;
      balances.set(
        row.studentId,
        (balances.get(row.studentId) ?? 0) +
          (row.direction === 'CREDIT' ? amount : -amount),
      );
    }
    const debtorIds = [...balances.entries()]
      .filter(([, balance]) => balance < 0)
      .map(([id]) => id);
    const students = await this.prisma.student.findMany({
      where: {
        id: { in: debtorIds },
        ...(query.search
          ? {
              OR: [
                { studentCode: { contains: query.search, mode: 'insensitive' } },
                { firstName: { contains: query.search, mode: 'insensitive' } },
                { lastName: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: { id: true, studentCode: true, firstName: true, lastName: true },
    });
    const data: DebtorApi[] = students.map((student) => {
      const balanceUzs = balances.get(student.id)!;
      return {
        studentId: student.id,
        studentCode: student.studentCode,
        studentName: `${student.firstName} ${student.lastName}`,
        balanceUzs,
        debtUzs: -balanceUzs,
      };
    });
    data.sort((left, right) => {
      const comparison =
        query.sortBy === 'studentName'
          ? left.studentName.localeCompare(right.studentName)
          : left.debtUzs - right.debtUzs;
      return query.sortOrder === 'asc' ? comparison : -comparison;
    });
    const start = (query.page - 1) * query.limit;
    return {
      data: data.slice(start, start + query.limit),
      meta: toPaginationMeta(query.page, query.limit, data.length),
    };
  }
}

function negativeOwnerTotal<T extends 'studentId' | 'teacherId'>(
  rows: ReadonlyArray<
    Record<T, string | null> & {
      direction: 'CREDIT' | 'DEBIT';
      _sum: { amountUzs: number | null };
    }
  >,
  ownerKey: T,
): number {
  const balances = ownerBalances(rows, ownerKey);
  return [...balances.values()].reduce(
    (total, balance) => total + Math.max(0, -balance),
    0,
  );
}

function positiveOwnerTotal<T extends 'studentId' | 'teacherId'>(
  rows: ReadonlyArray<
    Record<T, string | null> & {
      direction: 'CREDIT' | 'DEBIT';
      _sum: { amountUzs: number | null };
    }
  >,
  ownerKey: T,
): number {
  const balances = ownerBalances(rows, ownerKey);
  return [...balances.values()].reduce(
    (total, balance) => total + Math.max(0, balance),
    0,
  );
}

function ownerBalances<T extends 'studentId' | 'teacherId'>(
  rows: ReadonlyArray<
    Record<T, string | null> & {
      direction: 'CREDIT' | 'DEBIT';
      _sum: { amountUzs: number | null };
    }
  >,
  ownerKey: T,
): Map<string, number> {
  const balances = new Map<string, number>();
  for (const row of rows) {
    const ownerId = row[ownerKey];
    if (!ownerId) continue;
    const amount = row._sum.amountUzs ?? 0;
    balances.set(
      ownerId,
      (balances.get(ownerId) ?? 0) +
        (row.direction === 'CREDIT' ? amount : -amount),
    );
  }
  return balances;
}
