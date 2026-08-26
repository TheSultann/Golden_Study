import {
  roomCreateInputSchema,
  roomListQuerySchema,
  roomUpdateInputSchema,
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
import type { RoomService } from './room.service.js';

export function createRoomRouter(
  authService: AuthService,
  roomService: RoomService,
): Router {
  const router = Router();
  const authenticate = createAuthenticate(authService);
  const canWrite = requireRoles('SUPER_ADMIN', 'ADMIN');
  router.use(authenticate);
  router.get('/', async (request, response) => {
    const result = await roomService.list(roomListQuerySchema.parse(request.query));
    response.json(paginatedResponse(result.data, result.meta));
  });
  router.post('/', canWrite, async (request, response) => {
    response
      .status(201)
      .json(
        successResponse(
          await roomService.create(
            roomCreateInputSchema.parse(request.body as unknown),
          ),
        ),
      );
  });
  router.get('/:id', async (request, response) => {
    const { id } = uuidParamSchema.parse(request.params);
    response.json(successResponse(await roomService.get(id)));
  });
  router.patch('/:id', canWrite, async (request, response) => {
    const { id } = uuidParamSchema.parse(request.params);
    response.json(
      successResponse(
        await roomService.update(
          id,
          roomUpdateInputSchema.parse(request.body as unknown),
        ),
      ),
    );
  });
  router.delete('/:id', canWrite, async (request, response) => {
    const { id } = uuidParamSchema.parse(request.params);
    await roomService.deactivate(id);
    response.status(204).send();
  });
  return router;
}
