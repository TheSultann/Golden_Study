import type { TelegramLinkStatus, TelegramTriggerType } from '@golden-study/contracts';
import {
  telegramLinkStatusUpdateInputSchema,
  telegramNotificationEnqueueInputSchema,
} from '@golden-study/contracts';
import { Router } from 'express';

import { successResponse } from '../../common/http/api-response.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import { createAuthenticate } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { TelegramService } from './telegram.service.js';

export function createTelegramRouter(
  authService: AuthService,
  service: TelegramService,
): Router {
  const router = Router();
  router.use(createAuthenticate(authService));
  router.use(requireRoles('SUPER_ADMIN', 'ADMIN'));

  router.get('/', async (_request, response) => {
    const data = await service.getOverview();
    response.json(successResponse(data));
  });

  router.patch(
    '/links/:id/status',
    validateBody(telegramLinkStatusUpdateInputSchema),
    async (request, response) => {
      const { status } = request.body as { status: TelegramLinkStatus };
      const data = await service.setLinkStatus(String(request.params.id), status);
      response.json(successResponse(data));
    },
  );

  router.patch('/links/:id/approve', async (request, response) => {
    const data = await service.setLinkStatus(String(request.params.id), 'active');
    response.json(successResponse(data));
  });

  router.patch('/links/:id/reject', async (request, response) => {
    const data = await service.setLinkStatus(String(request.params.id), 'rejected');
    response.json(successResponse(data));
  });

  router.post(
    '/notifications',
    validateBody(telegramNotificationEnqueueInputSchema),
    async (request, response) => {
      const { linkId, triggerType } = request.body as {
        linkId: string;
        triggerType: TelegramTriggerType;
      };
      const data = await service.enqueueToLink(linkId, triggerType);
      response.status(201).json(successResponse(data));
    },
  );

  return router;
}
