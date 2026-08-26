import type { AnnouncementSendInput } from '@golden-study/contracts';
import { announcementSendInputSchema } from '@golden-study/contracts';
import { Router } from 'express';

import { successResponse } from '../../common/http/api-response.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import { createAuthenticate } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { AnnouncementService } from './announcement.service.js';

export function createAnnouncementRouter(
  authService: AuthService,
  service: AnnouncementService,
): Router {
  const router = Router();
  router.use(createAuthenticate(authService));
  router.use(requireRoles('SUPER_ADMIN', 'ADMIN'));

  router.get('/', async (_request, response) => {
    const data = await service.list();
    response.json(successResponse(data));
  });

  router.post(
    '/',
    validateBody(announcementSendInputSchema),
    async (request, response) => {
      const data = await service.send(
        request.body as AnnouncementSendInput,
        request.user!.id,
      );
      response.status(201).json(successResponse(data));
    },
  );

  return router;
}
