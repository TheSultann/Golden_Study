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

  router.get('/', requireRoles('SUPER_ADMIN', 'ADMIN'), async (_request, response) => {
    const data = await staffService.list();
    response.json(successResponse(data));
  });

  router.post('/', requireRoles('SUPER_ADMIN'), async (request, response) => {
    const input = staffCreateInputSchema.parse(request.body);
    const data = await staffService.create(input);
    response.status(201).json(successResponse(data));
  });

  router.patch('/:id', requireRoles('SUPER_ADMIN'), async (request, response) => {
    const input = staffMemberSchema.parse(request.body);
    const data = await staffService.update(input);
    response.json(successResponse(data));
  });

  router.patch('/:id/status', requireRoles('SUPER_ADMIN'), async (request, response) => {
    const { status } = request.body as { status: 'active' | 'blocked' | 'archived' };
    const id = request.params.id as string;
    const data = await staffService.setStatus(id, status);
    response.json(successResponse(data));
  });

  router.post('/:id/payout', requireRoles('SUPER_ADMIN', 'ADMIN'), async (request, response) => {
    const { amount, comment } = staffPayoutInputSchema.parse(request.body);
    const id = request.params.id as string;
    const actorUserId = request.user?.id ?? 'system';
    const data = await staffService.payout(id, amount, comment, actorUserId);
    response.json(successResponse(data));
  });

  return router;
}
