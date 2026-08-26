import { config } from 'dotenv';

config({
  path: new URL('../../../../.env', import.meta.url),
  quiet: true,
});

process.env.NODE_ENV = 'test';
process.env.API_PORT = '3000';
process.env.FRONTEND_URL = 'http://localhost:5173';
if (process.env.DATABASE_URL) {
  const databaseUrl = new URL(process.env.DATABASE_URL);
  databaseUrl.pathname = '/golden_study_test';
  process.env.DATABASE_URL = databaseUrl.toString();
}
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-at-least-32-characters';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-characters';
process.env.JWT_ACCESS_EXPIRES_IN_SECONDS = '900';
process.env.JWT_REFRESH_EXPIRES_IN_DAYS = '30';
process.env.BCRYPT_COST = '12';
process.env.SEED_SUPER_ADMIN_PASSWORD = 'super-admin-test-password';
process.env.SEED_ADMIN_PASSWORD = 'admin-test-password';
process.env.SEED_TEACHER_PASSWORD = 'teacher-test-password';
