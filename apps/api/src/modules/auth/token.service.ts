import { createHash } from 'node:crypto';

import type { AuthRole, AuthUser } from '@golden-study/contracts';
import jwt, { type JwtPayload } from 'jsonwebtoken';

import { ApiError } from '../../common/errors/api-error.js';
import { env } from '../../config/env.js';

export interface AccessTokenPayload extends JwtPayload {
  sub: string;
  role: AuthRole;
  teacherId: string | null;
  type: 'access';
}

export interface RefreshTokenPayload extends JwtPayload {
  sub: string;
  jti: string;
  type: 'refresh';
}

export function createAccessToken(user: AuthUser): string {
  return jwt.sign(
    {
      role: user.role,
      teacherId: user.teacherId,
      type: 'access',
    },
    env.JWT_ACCESS_SECRET,
    {
      subject: user.id,
      expiresIn: env.JWT_ACCESS_EXPIRES_IN_SECONDS,
    },
  );
}

export function createRefreshToken(userId: string, tokenId: string): string {
  return jwt.sign(
    {
      type: 'refresh',
    },
    env.JWT_REFRESH_SECRET,
    {
      subject: userId,
      jwtid: tokenId,
      expiresIn: env.JWT_REFRESH_EXPIRES_IN_DAYS * 24 * 60 * 60,
    },
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = verifyToken(token, env.JWT_ACCESS_SECRET);

  if (
    payload.type !== 'access' ||
    typeof payload.sub !== 'string' ||
    !isAuthRole(payload.role) ||
    !(typeof payload.teacherId === 'string' || payload.teacherId === null)
  ) {
    throw unauthorized();
  }

  return payload as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const payload = verifyToken(token, env.JWT_REFRESH_SECRET);

  if (
    payload.type !== 'refresh' ||
    typeof payload.sub !== 'string' ||
    typeof payload.jti !== 'string'
  ) {
    throw unauthorized();
  }

  return payload as RefreshTokenPayload;
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function verifyToken(token: string, secret: string): JwtPayload {
  try {
    const payload = jwt.verify(token, secret);

    if (typeof payload === 'string') {
      throw unauthorized();
    }

    return payload;
  } catch {
    throw unauthorized();
  }
}

function isAuthRole(value: unknown): value is AuthRole {
  return (
    value === 'SUPER_ADMIN' || value === 'ADMIN' || value === 'TEACHER'
  );
}

function unauthorized(): ApiError {
  return new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
}
