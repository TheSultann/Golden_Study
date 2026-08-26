import {
  leadConvertInputSchema,
  leadCreateInputSchema,
  leadListQuerySchema,
  leadStatusUpdateInputSchema,
  leadUpdateInputSchema,
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
import type { LeadService } from './lead.service.js';

export function createLeadRouter(
  authService: AuthService,
  service: LeadService,
): Router {
  const router = Router();
  router.use(createAuthenticate(authService));
  router.use(requireRoles('SUPER_ADMIN', 'ADMIN'));

  router.get('/', async (request, response) => {
    const result = await service.list(leadListQuerySchema.parse(request.query));
    response.json(paginatedResponse(result.data, result.meta));
  });
  router.post('/', async (request, response) => {
    response
      .status(201)
      .json(
        successResponse(
          await service.create(
            leadCreateInputSchema.parse(request.body as unknown),
          ),
        ),
      );
  });
  router.get('/:id', async (request, response) => {
    const { id } = uuidParamSchema.parse(request.params);
    response.json(successResponse(await service.get(id)));
  });
  router.patch('/:id', async (request, response) => {
    const { id } = uuidParamSchema.parse(request.params);
    response.json(
      successResponse(
        await service.update(
          id,
          leadUpdateInputSchema.parse(request.body as unknown),
        ),
      ),
    );
  });
  router.patch('/:id/status', async (request, response) => {
    const { id } = uuidParamSchema.parse(request.params);
    const { status } = leadStatusUpdateInputSchema.parse(
      request.body as unknown,
    );
    response.json(successResponse(await service.setStatus(id, status)));
  });
  router.post('/:id/convert', async (request, response) => {
    const { id } = uuidParamSchema.parse(request.params);
    const { groupId } = leadConvertInputSchema.parse(request.body as unknown);
    response
      .status(201)
      .json(successResponse(await service.convert(id, groupId)));
  });
  router.delete('/:id', async (request, response) => {
    const { id } = uuidParamSchema.parse(request.params);
    await service.archive(id);
    response.status(204).send();
  });
  return router;
}
