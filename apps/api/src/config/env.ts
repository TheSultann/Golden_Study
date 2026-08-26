import { config } from 'dotenv';

import { z } from 'zod';

config({
  path: new URL('../../../../.env', import.meta.url),
  quiet: true,
});

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  FRONTEND_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().url(),
  QUEUE_DRIVER: z.enum(['bullmq', 'memory']).default('bullmq'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN_SECONDS: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_EXPIRES_IN_DAYS: z.coerce.number().int().positive().default(30),
  BCRYPT_COST: z.coerce.number().int().min(10).max(14).default(12),
  SEED_SUPER_ADMIN_PASSWORD: z.string().min(12),
  SEED_ADMIN_PASSWORD: z.string().min(12),
  SEED_TEACHER_PASSWORD: z.string().min(12),
  TELEGRAM_BOT_TOKEN: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().min(1).optional(),
  ),
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(
  source: NodeJS.ProcessEnv | Record<string, string> = process.env,
): AppEnv {
  return envSchema.parse(source);
}

export const env = loadEnv();
