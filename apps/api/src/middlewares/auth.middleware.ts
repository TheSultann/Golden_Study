import type { RequestHandler } from 'express';

import { ApiError } from '../common/errors/api-error.js';
import type { AuthService } from '../modules/auth/auth.service.js';
import { verifyAccessToken } from '../modules/auth/token.service.js';

export function createAuthenticate(authService: AuthService): RequestHandler {
  return async (request, _response, next) => {
    try {
      let token: string | undefined;
      const authorization = request.header('authorization');
      if (authorization) {
        const [scheme, bearerToken] = authorization.split(' ');
        if (scheme === 'Bearer' && bearerToken) {
          token = bearerToken;
        }
      }

      if (!token && typeof request.query.token === 'string' && request.query.token.trim().length > 0) {
        token = request.query.token.trim();
      }

      if (!token) {
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
