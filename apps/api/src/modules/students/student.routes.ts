import {
  membershipCreateInputSchema,
  studentCreateInputSchema,
  studentListQuerySchema,
  studentUpdateInputSchema,
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
import type { StudentService } from './student.service.js';

export function createStudentRouter(
  authService: AuthService,
  service: StudentService,
): Router {
  const router = Router();
  const authenticate = createAuthenticate(authService);
  const canWriteAdmin = requireRoles('SUPER_ADMIN', 'ADMIN');
  const canWriteStudent = requireRoles('SUPER_ADMIN', 'ADMIN', 'TEACHER');
  router.use(authenticate);

  router.get('/', async (request, response) => {
    const result = await service.list(
      studentListQuerySchema.parse(request.query),
      request.user!,
    );
    response.json(paginatedResponse(result.data, result.meta));
  });
  router.post('/', canWriteStudent, async (request, response) => {
    response
      .status(201)
      .json(
        successResponse(
          await service.create(
            studentCreateInputSchema.parse(request.body as unknown),
          ),
        ),
      );
  });
  router.get('/:id/profile', async (request, response) => {
    const { id } = uuidParamSchema.parse(request.params);
    response.json(successResponse(await service.getProfile(id, request.user!)));
  });
  router.get('/:id', async (request, response) => {
    const { id } = uuidParamSchema.parse(request.params);
    response.json(successResponse(await service.get(id, request.user!)));
  });
  router.patch('/:id', canWriteStudent, async (request, response) => {
    const { id } = uuidParamSchema.parse(request.params);
    response.json(
      successResponse(
        await service.update(
          id,
          studentUpdateInputSchema.parse(request.body as unknown),
          request.user!,
        ),
      ),
    );
  });
  router.patch('/:id/freeze', canWriteAdmin, async (request, response) => {
    const { id } = uuidParamSchema.parse(request.params);
    response.json(successResponse(await service.setFrozen(id, true)));
  });
  router.patch('/:id/unfreeze', canWriteAdmin, async (request, response) => {
    const { id } = uuidParamSchema.parse(request.params);
    response.json(successResponse(await service.setFrozen(id, false)));
  });
  router.delete('/:id', canWriteAdmin, async (request, response) => {
    const { id } = uuidParamSchema.parse(request.params);
    await service.archive(id);
    response.status(204).send();
  });
  return router;
}

export function createMembershipRouter(
  authService: AuthService,
  service: StudentService,
): Router {
  const router = Router();
  const authenticate = createAuthenticate(authService);
  const canWriteAdmin = requireRoles('SUPER_ADMIN', 'ADMIN');
  const canWriteMembership = requireRoles('SUPER_ADMIN', 'ADMIN', 'TEACHER');
  router.use(authenticate);

  router.get('/:id/students', async (request, response) => {
    const { id } = uuidParamSchema.parse(request.params);
    response.json(
      successResponse(await service.listGroupStudents(id, request.user!)),
    );
  });
  router.post('/:id/students', canWriteMembership, async (request, response) => {
    const { id } = uuidParamSchema.parse(request.params);
    const { studentId } = membershipCreateInputSchema.parse(
      request.body as unknown,
    );
    response
      .status(201)
      .json(
        successResponse(
          await service.addToGroup(id, studentId, request.user!),
        ),
      );
  });
  router.delete(
    '/:id/students/:studentId',
    canWriteMembership,
    async (request, response) => {
      const { id, studentId } = membershipParams(request.params);
      await service.closeMembership(id, studentId, 'REMOVED', request.user!);
      response.status(204).send();
    },
  );
  router.patch(
    '/:id/students/:studentId/graduate',
    canWriteAdmin,
    async (request, response) => {
      const { id, studentId } = membershipParams(request.params);
      response.json(
        successResponse(
          await service.closeMembership(id, studentId, 'GRADUATE', request.user!),
        ),
      );
    },
  );
  return router;
}

function membershipParams(value: unknown) {
  return uuidParamSchema
    .extend({ studentId: uuidParamSchema.shape.id })
    .parse(value);
}
