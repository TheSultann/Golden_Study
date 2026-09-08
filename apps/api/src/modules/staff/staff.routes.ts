import { staffCreateInputSchema, staffMemberSchema, staffPayoutInputSchema } from '@golden-study/contracts';
import { Router } from 'express';
import { successResponse } from '../../common/http/api-response.js';
import { createAuthenticate } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { StaffService } from './staff.service.js';

export function createStaffRouter(
  authService: AuthService,
  staffService: StaffService,
): Router {
  const router = Router();
  router.use(createAuthenticate(authService));
  router.use(requireRoles('SUPER_ADMIN'));

  router.get('/', async (_request, response) => {
    const data = await staffService.list();
    response.json(successResponse(data));
  });

  router.post('/', async (request, response) => {
    const input = staffCreateInputSchema.parse(request.body);
    const data = await staffService.create(input);
    response.status(201).json(successResponse(data));
  });

  router.patch('/:id', async (request, response) => {
    const input = staffMemberSchema.parse(request.body);
    const data = await staffService.update(input);
    response.json(successResponse(data));
  });

  router.patch('/:id/status', async (request, response) => {
    const { status } = request.body as { status: 'active' | 'blocked' | 'archived' };
    const data = await staffService.setStatus(request.params.id, status);
    response.json(successResponse(data));
  });

  router.post('/:id/payout', async (request, response) => {
    const { amount, comment } = staffPayoutInputSchema.parse(request.body);
    const actorUserId = request.user?.id ?? 'system';
    const data = await staffService.payout(request.params.id, amount, comment, actorUserId);
    response.json(successResponse(data));
  });

  return router;
}
