import {
  billingRunListQuerySchema,
  billingReconcileInputSchema,
  dailyBillingReconcileInputSchema,
} from '@golden-study/contracts';
import { Router } from 'express';

import { successResponse } from '../../common/http/api-response.js';
import { createAuthenticate } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { MonthlyBillingService } from './monthly-billing.service.js';
import type { BillingService } from './billing.service.js';

export function createBillingRouter(
  authService: AuthService,
  daily: BillingService,
  monthly: MonthlyBillingService,
): Router {
  const router = Router();
  router.use(createAuthenticate(authService));
  router.use(requireRoles('SUPER_ADMIN', 'ADMIN'));
  router.post('/daily/reconcile', async (request, response) => {
    const { date } = dailyBillingReconcileInputSchema.parse(
      request.body as unknown,
    );
    response.json(
      successResponse(await daily.reconcileDaily(date, request.user!.id)),
    );
  });
  router.post('/monthly/reconcile', async (request, response) => {
    const { period } = billingReconcileInputSchema.parse(
      request.body as unknown,
    );
    response.json(
      successResponse(await monthly.reconcile(period, request.user!.id)),
    );
  });
  router.get('/runs', async (request, response) => {
    const result = await daily.listRuns(
      billingRunListQuerySchema.parse(request.query),
    );
    response.json({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  });
  return router;
}
