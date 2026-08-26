import type { RequestHandler } from 'express';

import { ApiError } from '../common/errors/api-error.js';
import type { AuthService } from '../modules/auth/auth.service.js';
import { verifyAccessToken } from '../modules/auth/token.service.js';

export function createAuthenticate(authService: AuthService): RequestHandler {
  return async (request, _response, next) => {
    try {
      const authorization = request.header('authorization');
      const [scheme, token] = authorization?.split(' ') ?? [];

      if (scheme !== 'Bearer' || !token) {
        throw unauthorized();
      }

      const payload = verifyAccessToken(token);
      const user = await authService.getCurrentUser(payload.sub);

      if (
        user.role !== payload.role
      ) {
        throw unauthorized();
      }

      request.user = user;
      next();
    } catch (error) {
      next(
        error instanceof ApiError && error.statusCode === 401
          ? error
          : unauthorized(),
      );
    }
  };
}

function unauthorized(): ApiError {
  return new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
}
