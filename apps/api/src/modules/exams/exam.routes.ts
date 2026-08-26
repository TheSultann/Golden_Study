import type { ExamSaveInput } from '@golden-study/contracts';
import { examSaveInputSchema } from '@golden-study/contracts';
import { Router } from 'express';
import { z } from 'zod';

import { successResponse } from '../../common/http/api-response.js';
import {
  validateBody,
  validateParams,
} from '../../middlewares/validate.middleware.js';
import { createAuthenticate } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { ExamService } from './exam.service.js';

const examIdParamSchema = z.object({ id: z.string().min(1).max(64) });

export function createExamRouter(
  authService: AuthService,
  service: ExamService,
): Router {
  const router = Router();
  router.use(createAuthenticate(authService));
  router.use(requireRoles('SUPER_ADMIN', 'ADMIN', 'TEACHER'));

  router.get('/', async (request, response) => {
    const data = await service.list(request.user!);
    response.json(successResponse(data));
  });

  router.put(
    '/:id',
    validateParams(examIdParamSchema),
    validateBody(examSaveInputSchema),
    async (request, response) => {
      const data = await service.save(
        String(request.params.id),
        request.body as ExamSaveInput,
        request.user!,
      );
      response.json(successResponse(data));
    },
  );

  router.delete(
    '/:id',
    validateParams(examIdParamSchema),
    async (request, response) => {
      await service.delete(String(request.params.id), request.user!);
      response.json(successResponse(null));
    },
  );

  return router;
}
