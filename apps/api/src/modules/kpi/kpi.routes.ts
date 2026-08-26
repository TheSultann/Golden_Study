import {
  reversalInputSchema,
  teacherPayoutInputSchema,
  uuidParamSchema,
} from '@golden-study/contracts';
import { Router } from 'express';
import { z } from 'zod';

import { successResponse } from '../../common/http/api-response.js';
import { createAuthenticate } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { KpiService } from './kpi.service.js';

const payoutParamsSchema = z.object({
  id: z.string().uuid(),
  payoutId: z.string().uuid(),
});

export function createKpiRouter(authService: AuthService, kpi: KpiService): Router {
  const router = Router();
  router.use(createAuthenticate(authService));
  router.get('/:id/kpi', requireRoles('SUPER_ADMIN', 'ADMIN'), async (request, response) => {
    const { id } = uuidParamSchema.parse(request.params);
    response.json(successResponse(await kpi.summary(id)));
  });
  router.post('/:id/payout', requireRoles('SUPER_ADMIN', 'ADMIN'), async (request, response) => {
    const { id } = uuidParamSchema.parse(request.params);
    const result = await kpi.payout(
      id,
      teacherPayoutInputSchema.parse(request.body as unknown),
      request.user!.id,
    );
    response.status(result.created ? 201 : 200).json(successResponse(result.data));
  });
  router.post('/:id/payouts/:payoutId/reverse', requireRoles('SUPER_ADMIN', 'ADMIN'), async (request, response) => {
    const { id, payoutId } = payoutParamsSchema.parse(request.params);
    const { comment } = reversalInputSchema.parse(request.body as unknown);
    response.status(201).json(successResponse(
      await kpi.reversePayout(id, payoutId, comment, request.user!.id),
    ));
  });
  return router;
}
