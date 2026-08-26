import type {
  PaymentApi,
  StudentPaymentCreateInput,
} from '@golden-study/contracts';
import type { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { ApiError } from '../../common/errors/api-error.js';
import { paymentOperationKey } from './finance-calculation.js';
import {
  createFinanceAudit,
  toLedgerApi,
} from './ledger.service.js';
import type { TelegramNotifier } from '../telegram/telegram.service.js';

const paymentInclude = {
  ledgerEntry: true,
} satisfies Prisma.PaymentInclude;

export class PaymentService {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly notifier?: TelegramNotifier,
  ) {}

  public async create(
    input: StudentPaymentCreateInput,
    actorUserId: string,
  ): Promise<{ data: PaymentApi; created: boolean }> {
    const paymentId = randomUUID();
    const operationKey = paymentOperationKey(
      input.idempotencyKey ?? paymentId,
    );
    const existing = await this.findByOperationKey(operationKey);
    if (existing) return { data: toPaymentApi(existing), created: false };
    try {
      const row = await this.prisma.$transaction(
        async (transaction) => {
          const student = await transaction.student.findUnique({
            where: { id: input.studentId },
          });
          if (!student || student.status === 'ARCHIVED') {
            throw new ApiError(
              422,
              'BUSINESS_ERROR',
              'Non-archived student required',
            );
          }
          if (input.groupId) {
            const membership = await transaction.groupStudent.count({
              where: {
                studentId: input.studentId,
                groupId: input.groupId,
              },
            });
            if (membership === 0) {
              throw new ApiError(
                422,
                'BUSINESS_ERROR',
                'Student group membership required',
              );
            }
          }
          const ledger = await transaction.ledgerEntry.create({
            data: {
              accountType: 'STUDENT',
              studentId: input.studentId,
              direction: 'CREDIT',
              category: 'STUDENT_PAYMENT',
              amountUzs: input.amountUzs,
              operationKey,
              sourceType: 'PAYMENT',
              sourceId: paymentId,
              comment: input.comment,
              createdByUserId: actorUserId,
            },
          });
          const payment = await transaction.payment.create({
            data: {
              id: paymentId,
              studentId: input.studentId,
              groupId: input.groupId ?? null,
              amountUzs: input.amountUzs,
              method: input.method,
              comment: input.comment,
              ledgerEntryId: ledger.id,
              createdByUserId: actorUserId,
            },
            include: paymentInclude,
          });
          await createFinanceAudit(
            transaction,
            actorUserId,
            'FINANCE_PAYMENT',
            payment.id,
            'CREATE',
            ledger,
          );
          return payment;
        },
        { isolationLevel: 'Serializable' },
      );
      const api = toPaymentApi(row);
      await this.notifyPaymentReceived(api);
      return { data: api, created: true };
    } catch (error) {
      if (isPrismaCode(error, 'P2002')) {
        const row = await this.findByOperationKey(operationKey);
        if (row) return { data: toPaymentApi(row), created: false };
      }
      throw error;
    }
  }

  private async notifyPaymentReceived(payment: PaymentApi): Promise<void> {
    const notifier = this.notifier;
    if (!notifier) return;
    await notifier
      .notifyStudent(
        payment.studentId,
        'payment_received',
        { amountUzs: payment.amountUzs, method: payment.method },
        `payment-received:${payment.id}`,
      )
      .catch((error) => {
        console.error('[telegram] payment notification failed:', error);
      });
  }

  public async reverse(
    paymentId: string,
    comment: string,
    actorUserId: string,
  ) {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const payment = await transaction.payment.findUnique({
          where: { id: paymentId },
          include: {
            ledgerEntry: { include: { reversedBy: true } },
          },
        });
        if (!payment) {
          throw new ApiError(404, 'NOT_FOUND', 'Payment not found');
        }
        if (payment.ledgerEntry.reversedBy) {
          throw new ApiError(409, 'CONFLICT', 'Payment already reversed');
        }
        const reversal = await transaction.ledgerEntry.create({
          data: {
            accountType: 'STUDENT',
            studentId: payment.studentId,
            direction: 'DEBIT',
            category: 'REVERSAL',
            amountUzs: payment.amountUzs,
            operationKey: `payment:${payment.id}:reversal:v1`,
            sourceType: 'REVERSAL',
            sourceId: payment.id,
            reversalOfId: payment.ledgerEntryId,
            comment,
            createdByUserId: actorUserId,
          },
        });
        await createFinanceAudit(
          transaction,
          actorUserId,
          'FINANCE_PAYMENT',
          payment.id,
          'REVERSE',
          reversal,
        );
        return toLedgerApi(reversal);
      });
    } catch (error) {
      if (isPrismaCode(error, 'P2002')) {
        throw new ApiError(409, 'CONFLICT', 'Payment already reversed');
      }
      throw error;
    }
  }

  private findByOperationKey(operationKey: string) {
    return this.prisma.payment.findFirst({
      where: { ledgerEntry: { operationKey } },
      include: paymentInclude,
    });
  }
}

function toPaymentApi(
  row: Prisma.PaymentGetPayload<{ include: typeof paymentInclude }>,
): PaymentApi {
  return {
    id: row.id,
    studentId: row.studentId,
    groupId: row.groupId,
    amountUzs: row.amountUzs,
    method: row.method,
    comment: row.comment,
    ledgerEntry: toLedgerApi(row.ledgerEntry),
    createdAt: row.createdAt.toISOString(),
  };
}

function isPrismaCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === code
  );
}
