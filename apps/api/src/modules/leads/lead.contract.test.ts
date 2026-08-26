import {
  leadConvertInputSchema,
  leadCreateInputSchema,
  leadStatusUpdateInputSchema,
} from '@golden-study/contracts';
import { describe, expect, it } from 'vitest';

describe('lead API contracts', () => {
  it('accepts normalized lead input and rejects unknown fields', () => {
    expect(
      leadCreateInputSchema.safeParse({
        fullName: 'Ali Valiyev',
        phone: '+998901234567',
        comment: '',
      }).success,
    ).toBe(true);
    expect(
      leadCreateInputSchema.safeParse({
        fullName: 'Ali Valiyev',
        phone: '+998901234567',
        unknown: true,
      }).success,
    ).toBe(false);
  });

  it('does not allow status endpoint to set terminal archive state', () => {
    expect(
      leadStatusUpdateInputSchema.safeParse({ status: 'TRIAL' }).success,
    ).toBe(true);
    expect(
      leadStatusUpdateInputSchema.safeParse({ status: 'ARCHIVED' }).success,
    ).toBe(false);
    expect(
      leadStatusUpdateInputSchema.safeParse({ status: 'CONVERTED' }).success,
    ).toBe(false);
  });

  it('allows optional active group during conversion', () => {
    expect(leadConvertInputSchema.safeParse({}).success).toBe(true);
    expect(
      leadConvertInputSchema.safeParse({
        groupId: '00000000-0000-4000-8000-000000000001',
      }).success,
    ).toBe(true);
  });
});
