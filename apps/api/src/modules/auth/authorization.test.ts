import { describe, expect, it } from 'vitest';

import { isRoleAllowed } from '../../middlewares/role.middleware.js';
import { assertTeacherOwnership } from './teacher-ownership.js';

const teacher = {
  id: '11111111-1111-4111-8111-111111111111',
  login: 'teacher',
  role: 'TEACHER' as const,
  teacherId: '22222222-2222-4222-8222-222222222222',
};

describe('RBAC', () => {
  it('allows an explicitly permitted role', () => {
    expect(isRoleAllowed('SUPER_ADMIN', ['SUPER_ADMIN'])).toBe(true);
  });

  it('denies a role outside the allow-list', () => {
    expect(isRoleAllowed('ADMIN', ['SUPER_ADMIN'])).toBe(false);
  });
});

describe('teacher ownership', () => {
  it('allows a teacher to access own resource', () => {
    expect(() =>
      assertTeacherOwnership(teacher, teacher.teacherId),
    ).not.toThrow();
  });

  it('denies a teacher access to another teacher resource', () => {
    expect(() =>
      assertTeacherOwnership(
        teacher,
        '33333333-3333-4333-8333-333333333333',
      ),
    ).toThrowError(
      expect.objectContaining({ statusCode: 403, code: 'FORBIDDEN' }),
    );
  });

  it('allows admins through ownership policy', () => {
    expect(() =>
      assertTeacherOwnership({ ...teacher, role: 'ADMIN' }, 'other'),
    ).not.toThrow();
  });
});
