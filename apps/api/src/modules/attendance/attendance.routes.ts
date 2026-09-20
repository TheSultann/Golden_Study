import {
  attendanceBroadcastInputSchema,
  attendanceBulkSaveInputSchema,
  attendanceListQuerySchema,
  attendanceSessionParamsSchema,
  attendanceUpdateInputSchema,
  uuidParamSchema,
} from '@golden-study/contracts';
import { Router } from 'express';
import { z } from 'zod';

const groupIdParamSchema = z.object({ groupId: z.string().uuid() });

import {
  paginatedResponse,
  successResponse,
} from '../../common/http/api-response.js';
import { createAuthenticate } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { AttendanceService } from './attendance.service.js';

export function createAttendanceRouter(
  authService: AuthService,
  service: AttendanceService,
): Router {
  const router = Router();
  const authenticate = createAuthenticate(authService);
  const adminOnly = requireRoles('SUPER_ADMIN', 'ADMIN');
  router.use(authenticate);

  router.get('/', async (request, response) => {
    const result = await service.list(
      attendanceListQuerySchema.parse(request.query),
      request.user!,
    );
    response.json(paginatedResponse(result.data, result.meta));
  });
  router.get('/group/:groupId/date/:date', async (request, response) => {
    const { groupId, date } = attendanceSessionParamsSchema.parse(
      request.params,
    );
    response.json(
      successResponse(await service.getSession(groupId, date, request.user!)),
    );
  });
  router.post('/group/:groupId/broadcast', async (request, response) => {
    const { groupId } = groupIdParamSchema.parse(request.params);
    const bodyObj = typeof request.body === 'object' && request.body !== null ? request.body : {};
    const input = attendanceBroadcastInputSchema.parse({
      ...bodyObj,
      groupId,
    });
    const result = await service.broadcastLesson(groupId, input, request.user!);
    response.json(successResponse(result));
  });
  router.post('/', async (request, response) => {
    response.json(
      successResponse(
        await service.save(
          attendanceBulkSaveInputSchema.parse(request.body as unknown),
          request.user!,
        ),
      ),
    );
  });
  router.patch('/:id', adminOnly, async (request, response) => {
    const { id } = uuidParamSchema.parse(request.params);
    response.json(
      successResponse(
        await service.update(
          id,
          attendanceUpdateInputSchema.parse(request.body as unknown),
          request.user!.id,
        ),
      ),
    );
  });
  router.delete('/:id', adminOnly, async (request, response) => {
    const { id } = uuidParamSchema.parse(request.params);
    await service.reverse(id, request.user!.id);
    response.status(204).send();
  });
  return router;
}

export function createStudentAttendanceRouter(
  authService: AuthService,
  service: AttendanceService,
): Router {
  const router = Router();
  router.use(createAuthenticate(authService));
  router.get('/:id/attendance', async (request, response) => {
    const { id } = uuidParamSchema.parse(request.params);
    const result = await service.listStudentHistory(
      id,
      attendanceListQuerySchema.parse(request.query),
      request.user!,
    );
    response.json(paginatedResponse(result.data, result.meta));
  });
  return router;
}
