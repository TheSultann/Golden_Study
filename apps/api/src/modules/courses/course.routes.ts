import {
  courseCreateInputSchema,
  courseListQuerySchema,
  courseStatusUpdateInputSchema,
  courseUpdateInputSchema,
  uuidParamSchema,
} from '@golden-study/contracts';
import { Router } from 'express';

import {
  paginatedResponse,
  successResponse,
} from '../../common/http/api-response.js';
import { createAuthenticate } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { CourseService } from './course.service.js';

export function createCourseRouter(
  authService: AuthService,
  courseService: CourseService,
): Router {
  const router = Router();
  const authenticate = createAuthenticate(authService);
  const canWrite = requireRoles('SUPER_ADMIN', 'ADMIN');
  router.use(authenticate);

  router.get('/', async (request, response) => {
    const result = await courseService.list(
      courseListQuerySchema.parse(request.query),
    );
    response.json(paginatedResponse(result.data, result.meta));
  });
  router.post('/', canWrite, async (request, response) => {
    const data = await courseService.create(
      courseCreateInputSchema.parse(request.body as unknown),
    );
    response.status(201).json(successResponse(data));
  });
  router.get('/:id', async (request, response) => {
    const { id } = uuidParamSchema.parse(request.params);
    response.json(successResponse(await courseService.get(id)));
  });
  router.patch('/:id', canWrite, async (request, response) => {
    const { id } = uuidParamSchema.parse(request.params);
    const input = courseUpdateInputSchema.parse(request.body as unknown);
    response.json(successResponse(await courseService.update(id, input)));
  });
  router.patch('/:id/status', canWrite, async (request, response) => {
    const { id } = uuidParamSchema.parse(request.params);
    const { isActive } = courseStatusUpdateInputSchema.parse(
      request.body as unknown,
    );
    response.json(
      successResponse(await courseService.setStatus(id, isActive)),
    );
  });
  router.delete('/:id', canWrite, async (request, response) => {
    const { id } = uuidParamSchema.parse(request.params);
    await courseService.deactivate(id);
    response.status(204).send();
  });
  return router;
}
