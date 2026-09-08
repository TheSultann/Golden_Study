import type { CookieOptions, Response } from 'express';

import { env } from '../../config/env.js';

export const REFRESH_COOKIE_NAME = 'golden_refresh';

const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: env.FRONTEND_URL.startsWith('https://'),
  path: '/api/v1/auth',
  maxAge: env.JWT_REFRESH_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1_000,
};

export function setRefreshCookie(response: Response, token: string): void {
  response.cookie(REFRESH_COOKIE_NAME, token, refreshCookieOptions);
}

export function clearRefreshCookie(response: Response): void {
  response.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions);
}
