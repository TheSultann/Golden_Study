import {
  teacherCreateInputSchema,
  teacherUpdateInputSchema,
} from '@golden-study/contracts';
import { describe, expect, it } from 'vitest';

describe('teacher contracts', () => {
  it('requires the salary field matching salaryType', () => {
    expect(
      teacherCreateInputSchema.safeParse({
        firstName: 'Ali',
        lastName: 'Valiyev',
        phone: '+998901234567',
        salaryType: 'FIXED',
        login: 'ali',
        password: 'SecurePass123',
      }).success,
    ).toBe(false);

    expect(
      teacherCreateInputSchema.safeParse({
        firstName: 'Ali',
        lastName: 'Valiyev',
        phone: '+998901234567',
        salaryType: 'PERCENT',
        kpiRateBasisPoints: 1250,
        login: 'ali',
        password: 'SecurePass123',
      }).success,
    ).toBe(true);
  });

  it('rejects an empty update', () => {
    expect(teacherUpdateInputSchema.safeParse({}).success).toBe(false);
  });
});
