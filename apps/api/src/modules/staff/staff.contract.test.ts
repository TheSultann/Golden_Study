import {
  staffCreateInputSchema,
  staffListResponseSchema,
  staffMemberSchema,
} from '@golden-study/contracts';
import { describe, expect, it } from 'vitest';

describe('staff API contracts', () => {
  it('validates staff member schema with formatted and raw phone numbers', () => {
    const rawMember = {
      id: 'usr-1',
      fullName: 'Super Administrator',
      login: 'superadmin',
      phone: '+998901234567',
      role: 'admin',
      status: 'active',
      linkedTeacherId: null,
      lastLoginAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    const formattedMember = {
      ...rawMember,
      phone: '+998 90 123 45 67',
    };

    expect(staffMemberSchema.safeParse(rawMember).success).toBe(true);
    expect(staffMemberSchema.safeParse(formattedMember).success).toBe(true);
    expect(staffListResponseSchema.safeParse({ data: [formattedMember] }).success).toBe(true);
  });

  it('validates staff creation input', () => {
    const valid = {
      fullName: 'Javohir Toshov',
      login: 'jtoshov',
      phone: '+998901112233',
      role: 'admin',
      password: 'password123',
    };

    expect(staffCreateInputSchema.safeParse(valid).success).toBe(true);
    expect(staffCreateInputSchema.safeParse({ ...valid, password: 'short' }).success).toBe(false);
  });
});
