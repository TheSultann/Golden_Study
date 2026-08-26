import {
  teacherCreateInputSchema,
  teacherListQuerySchema,
  teacherUpdateInputSchema,
  uuidParamSchema,
} from '@golden-study/contracts';
import { Router } from 'express';

import {
  paginatedResponse,
  successResponse,
} from '../../common/http/api-response.js';
import { ApiError } from '../../common/errors/api-error.js';
import { createAuthenticate } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { TeacherService } from './teacher.service.js';

export function createTeacherRouter(
  authService: AuthService,
  teacherService: TeacherService,
): Router {
  const router = Router();
  const authenticate = createAuthenticate(authService);
  const canWrite = requireRoles('SUPER_ADMIN', 'ADMIN');
  router.use(authenticate);

  router.get('/', requireRoles('SUPER_ADMIN', 'ADMIN'), async (request, response) => {
    const result = await teacherService.list(
      teacherListQuerySchema.parse(request.query),
    );
    response.json(paginatedResponse(result.data, result.meta));
  });
  router.post('/', canWrite, async (request, response) => {
    const data = await teacherService.create(
      teacherCreateInputSchema.parse(request.body as unknown),
    );
    response.status(201).json(successResponse(data));
  });
  router.get('/:id', async (request, response) => {
    const { id } = uuidParamSchema.parse(request.params);
    if (request.user?.role === 'TEACHER' && request.user.teacherId !== id) {
      throw new ApiError(403, 'FORBIDDEN', 'Access denied');
    }
    response.json(successResponse(await teacherService.get(id)));
  });
  router.patch('/:id', canWrite, async (request, response) => {
    const { id } = uuidParamSchema.parse(request.params);
    response.json(
      successResponse(
        await teacherService.update(
          id,
          teacherUpdateInputSchema.parse(request.body as unknown),
        ),
      ),
    );
  });
  router.delete('/:id', canWrite, async (request, response) => {
    const { id } = uuidParamSchema.parse(request.params);
    await teacherService.deactivate(id);
    response.status(204).send();
  });
  return router;
}
