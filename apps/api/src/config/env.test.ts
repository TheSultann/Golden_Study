import { describe, expect, it } from 'vitest';

import { loadEnv } from './env.js';

const validEnv = {
  NODE_ENV: 'test',
  API_PORT: '3000',
  FRONTEND_URL: 'http://localhost:5173',
  DATABASE_URL:
    'postgresql://postgres:postgres@localhost:5432/golden_study_test',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'test-access-secret-at-least-32-characters',
  JWT_REFRESH_SECRET: 'test-refresh-secret-at-least-32-characters',
  SEED_SUPER_ADMIN_PASSWORD: 'super-admin-test-password',
  SEED_ADMIN_PASSWORD: 'admin-test-password',
  SEED_TEACHER_PASSWORD: 'teacher-test-password',
};

describe('loadEnv', () => {
  it('parses a valid environment', () => {
    expect(loadEnv(validEnv).API_PORT).toBe(3000);
  });

  it('rejects an empty access token secret', () => {
    expect(() =>
      loadEnv({ ...validEnv, JWT_ACCESS_SECRET: '' }),
    ).toThrowError();
  });

  it('rejects an invalid API port', () => {
    expect(() => loadEnv({ ...validEnv, API_PORT: 'invalid' })).toThrowError();
  });

  it('treats an empty optional Telegram token as unset', () => {
    expect(loadEnv({ ...validEnv, TELEGRAM_BOT_TOKEN: '' }).TELEGRAM_BOT_TOKEN)
      .toBeUndefined();
  });
});
