import pino from 'pino';

import { env } from './env.js';

export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'passwordHash',
      'accessToken',
      'refreshToken',
    ],
    censor: '[REDACTED]',
  },
});
