import { changePasswordRequestSchema, loginRequestSchema } from '@golden-study/contracts';
import type { Request, RequestHandler } from 'express';

import { ApiError } from '../../common/errors/api-error.js';
import { successResponse } from '../../common/http/api-response.js';
import type { AuthService } from './auth.service.js';
import {
  clearRefreshCookie,
  REFRESH_COOKIE_NAME,
  setRefreshCookie,
} from './auth.cookies.js';

export function createAuthController(authService: AuthService) {
  const login: RequestHandler = async (request, response) => {
    const body = loginRequestSchema.parse(request.body as unknown);
    const result = await authService.login(body.login, body.password);
    setRefreshCookie(response, result.refreshToken);
    response.json(
      successResponse({
        user: result.user,
        accessToken: result.accessToken,
        expiresInSeconds: result.expiresInSeconds,
      }),
    );
  };

  const refresh: RequestHandler = async (request, response) => {
    const token = getRefreshCookie(request);
    if (!token) throw invalidToken();

    const result = await authService.refresh(token);
    setRefreshCookie(response, result.refreshToken);
    response.json(
      successResponse({
        accessToken: result.accessToken,
        expiresInSeconds: result.expiresInSeconds,
      }),
    );
  };

  const logout: RequestHandler = async (request, response) => {
    const token = getRefreshCookie(request);
    await authService.logout(token);
    clearRefreshCookie(response);
    response.status(204).send();
  };

  const me: RequestHandler = (request, response) => {
    response.json(successResponse(request.user));
  };

  const sessions: RequestHandler = async (request, response) => {
    if (!request.user) throw invalidToken();
    response.json(
      successResponse(await authService.listSessions(request.user.id)),
    );
  };

  const changePassword: RequestHandler = async (request, response) => {
    if (!request.user) throw invalidToken();
    const body = changePasswordRequestSchema.parse(request.body as unknown);
    await authService.changePassword(
      request.user.id,
      body.currentPassword,
      body.newPassword,
    );
    response.json(successResponse({ message: 'Parol muvaffaqiyatli yangilandi' }));
  };

  return { login, refresh, logout, me, sessions, changePassword };
}

function getRefreshCookie(request: Request): string | undefined {
  const cookies = request.cookies as unknown;
  if (!cookies || typeof cookies !== 'object') return undefined;

  const token = Reflect.get(cookies, REFRESH_COOKIE_NAME) as unknown;
  return typeof token === 'string' ? token : undefined;
}

function invalidToken(): ApiError {
  return new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
}
