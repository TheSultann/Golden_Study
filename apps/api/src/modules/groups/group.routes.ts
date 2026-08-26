import {
  groupCreateInputSchema,
  groupListQuerySchema,
  groupStatusUpdateInputSchema,
  groupUpdateInputSchema,
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
import type { GroupService } from './group.service.js';

export function createGroupRouter(
  authService: AuthService,
  groupService: GroupService,
): Router {
  const router = Router();
  const authenticate = createAuthenticate(authService);
  const canWrite = requireRoles('SUPER_ADMIN', 'ADMIN');
  router.use(authenticate);

  router.get('/', async (request, response) => {
    const result = await groupService.list(
      groupListQuerySchema.parse(request.query),
      request.user!,
    );
    response.json(paginatedResponse(result.data, result.meta));
  });
  router.post('/', canWrite, async (request, response) => {
    const data = await groupService.create(
      groupCreateInputSchema.parse(request.body as unknown),
    );
    response.status(201).json(successResponse(data));
  });
  router.get('/:id', async (request, response) => {
    const { id } = uuidParamSchema.parse(request.params);
    response.json(successResponse(await groupService.get(id, request.user!)));
  });
  router.patch('/:id', canWrite, async (request, response) => {
    const { id } = uuidParamSchema.parse(request.params);
    response.json(
      successResponse(
        await groupService.update(
          id,
          groupUpdateInputSchema.parse(request.body as unknown),
        ),
      ),
    );
  });
  router.patch('/:id/status', canWrite, async (request, response) => {
    const { id } = uuidParamSchema.parse(request.params);
    const { status } = groupStatusUpdateInputSchema.parse(
      request.body as unknown,
    );
    response.json(successResponse(await groupService.setStatus(id, status)));
  });
  router.delete('/:id', canWrite, async (request, response) => {
    const { id } = uuidParamSchema.parse(request.params);
    await groupService.archive(id);
    response.status(204).send();
  });
  return router;
}
