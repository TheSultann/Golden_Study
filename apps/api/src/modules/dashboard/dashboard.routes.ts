import { Router } from 'express';
import { successResponse } from '../../common/http/api-response.js';
import { createAuthenticate } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { DashboardService } from './dashboard.service.js';

export function createDashboardRouter(
  authService: AuthService,
  dashboardService: DashboardService,
): Router {
  const router = Router();
  router.use(createAuthenticate(authService));
  router.use(requireRoles('SUPER_ADMIN', 'ADMIN'));
  router.get('/', async (_request, response) => {
    const data = await dashboardService.getDashboardData();
    response.json(successResponse(data));
  });
  return router;
}
