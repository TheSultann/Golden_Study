import { changePasswordRequestSchema, loginRequestSchema } from '@golden-study/contracts';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';

import { createAuthenticate } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import type { AuthService } from './auth.service.js';
import { createAuthController } from './auth.controller.js';

export function createAuthRouter(authService: AuthService): Router {
  const router = Router();
  const controller = createAuthController(authService);
  const authenticate = createAuthenticate(authService);
  const authRateLimit = rateLimit({
    windowMs: 15 * 60 * 1_000,
    limit: process.env.NODE_ENV === 'production' ? 10 : 10000,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    handler: (_request, response) => {
      response.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many authentication attempts',
        },
      });
    },
  });

  router.post(
    '/login',
    authRateLimit,
    validateBody(loginRequestSchema),
    controller.login,
  );
  router.post('/refresh', authRateLimit, controller.refresh);
  router.post('/logout', controller.logout);
  router.get('/me', authenticate, controller.me);
  router.get(
    '/sessions',
    authenticate,
    requireRoles('SUPER_ADMIN'),
    controller.sessions,
  );
  router.post(
    '/change-password',
    authenticate,
    validateBody(changePasswordRequestSchema),
    controller.changePassword,
  );

  return router;
}
