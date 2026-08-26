import type { AuthRole } from '@golden-study/contracts';
import type { RequestHandler } from 'express';

import { ApiError } from '../common/errors/api-error.js';

export function isRoleAllowed(
  currentRole: AuthRole,
  allowedRoles: readonly AuthRole[],
): boolean {
  return allowedRoles.includes(currentRole);
}

export function requireRoles(...allowedRoles: AuthRole[]): RequestHandler {
  return (request, _response, next) => {
    if (!request.user) {
      next(new ApiError(401, 'UNAUTHORIZED', 'Authentication required'));
      return;
    }

    if (!isRoleAllowed(request.user.role, allowedRoles)) {
      next(new ApiError(403, 'FORBIDDEN', 'Access denied'));
      return;
    }

    next();
  };
}
