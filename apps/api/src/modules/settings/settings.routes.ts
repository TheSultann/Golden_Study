import { Router } from 'express';
import { successResponse } from '../../common/http/api-response.js';
import { createAuthenticate } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { SettingsService } from './settings.service.js';

export function createSettingsRouter(
  authService: AuthService,
  settingsService: SettingsService,
): Router {
  const router = Router();
  router.use(createAuthenticate(authService));
  router.use(requireRoles('SUPER_ADMIN', 'ADMIN'));

  router.get('/', async (_request, response) => {
    const data = await settingsService.getSettings();
    response.json(successResponse(data));
  });

  router.patch('/', requireRoles('SUPER_ADMIN'), async (request, response) => {
    const data = await settingsService.updateSettings(request.body as Record<string, unknown>);
    response.json(successResponse(data));
  });

  return router;
}
