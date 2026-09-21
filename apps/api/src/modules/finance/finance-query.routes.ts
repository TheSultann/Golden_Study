import { debtorListQuerySchema } from '@golden-study/contracts';
import { Router } from 'express';

import {
  paginatedResponse,
  successResponse,
} from '../../common/http/api-response.js';
import { createAuthenticate } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { FinanceQueryService } from './finance-query.service.js';

export function createFinanceQueryRouter(
  authService: AuthService,
  finance: FinanceQueryService,
): Router {
  const router = Router();
  router.use(createAuthenticate(authService));
  router.use(requireRoles('SUPER_ADMIN', 'ADMIN'));
  router.get('/summary', async (_request, response) => {
    response.json(successResponse(await finance.summary()));
  });
  router.get('/debtors', async (request, response) => {
    const result = await finance.debtors(
      debtorListQuerySchema.parse(request.query),
    );
    response.json(paginatedResponse(result.data, result.meta));
  });
  return router;
}
