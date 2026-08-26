import {
  manualTransactionCreateInputSchema,
  studentPaymentCreateInputSchema,
  transactionListQuerySchema,
} from '@golden-study/contracts';
import { describe, expect, it } from 'vitest';

describe('finance API contracts', () => {
  it('accepts positive integer payment and rejects float/zero', () => {
    const valid = {
      studentId: '00000000-0000-4000-8000-000000000001',
      amountUzs: 500000,
      method: 'CASH',
      comment: 'July',
      idempotencyKey: 'cash-receipt-1',
    };
    expect(studentPaymentCreateInputSchema.safeParse(valid).success).toBe(true);
    expect(
      studentPaymentCreateInputSchema.safeParse({ ...valid, amountUzs: 1.5 })
        .success,
    ).toBe(false);
    expect(
      studentPaymentCreateInputSchema.safeParse({ ...valid, amountUzs: 0 })
        .success,
    ).toBe(false);
  });

  it('limits manual transactions to center income/expense', () => {
    expect(
      manualTransactionCreateInputSchema.safeParse({
        direction: 'CREDIT',
        amountUzs: 100000,
        categoryLabel: 'Other income',
        subject: 'Center',
        comment: '',
      }).success,
    ).toBe(true);
  });

  it('validates transaction date range', () => {
    expect(
      transactionListQuerySchema.safeParse({
        dateFrom: '2026-08-01',
        dateTo: '2026-07-01',
      }).success,
    ).toBe(false);
  });
});
