import { loginRequestSchema } from '@golden-study/contracts';
import { describe, expect, it } from 'vitest';

import { loadEnv } from '../../config/env.js';

const validEnv = {
  NODE_ENV: 'test',
  API_PORT: '3000',
  FRONTEND_URL: 'http://localhost:5173',
  DATABASE_URL:
    'postgresql://postgres:postgres@localhost:5000/golden_study_test',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'test-access-secret-at-least-32-characters',
  JWT_REFRESH_SECRET: 'test-refresh-secret-at-least-32-characters',
  JWT_ACCESS_EXPIRES_IN_SECONDS: '900',
  JWT_REFRESH_EXPIRES_IN_DAYS: '30',
  BCRYPT_COST: '12',
  SEED_SUPER_ADMIN_PASSWORD: 'super-admin-test-password',
  SEED_ADMIN_PASSWORD: 'admin-test-password',
  SEED_TEACHER_PASSWORD: 'teacher-test-password',
};

describe('Auth contracts', () => {
  it('normalizes login before authentication', () => {
    expect(
      loginRequestSchema.parse({
        login: '  Admin  ',
        password: 'password123',
      }).login,
    ).toBe('admin');
  });

  it('rejects a short password', () => {
    expect(() =>
      loginRequestSchema.parse({ login: 'admin', password: 'short' }),
    ).toThrowError();
  });
});

describe('Auth environment', () => {
  it('parses token TTL, bcrypt cost and seed passwords', () => {
    const parsed = loadEnv(validEnv);

    expect(parsed.JWT_ACCESS_EXPIRES_IN_SECONDS).toBe(900);
    expect(parsed.JWT_REFRESH_EXPIRES_IN_DAYS).toBe(30);
    expect(parsed.BCRYPT_COST).toBe(12);
  });
});
