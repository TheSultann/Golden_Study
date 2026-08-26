import { randomUUID } from 'node:crypto';

import type {
  AuthSession,
  AuthTokenData,
  AuthUser,
  RefreshTokenData,
} from '@golden-study/contracts';

import { ApiError } from '../../common/errors/api-error.js';
import { env } from '../../config/env.js';
import type {
  AuthRepository,
  AuthUserRecord,
  NewRefreshSession,
} from './auth.repository.js';
import { hashPassword, verifyPassword } from './password.service.js';
import {
  createAccessToken,
  createRefreshToken,
  hashRefreshToken,
  verifyRefreshToken,
} from './token.service.js';

const DUMMY_PASSWORD_HASH =
  '$2b$12$C6UzMDM.H6dfI/f/IKcEe.1cVnZ9gJ6Fj6V7B5uJ7YwI6E5w4w6eK';

export interface LoginResult extends AuthTokenData {
  refreshToken: string;
}

export interface RefreshResult extends RefreshTokenData {
  refreshToken: string;
}

export class AuthService {
  public constructor(private readonly repository: AuthRepository) {}

  public async login(login: string, password: string): Promise<LoginResult> {
    const user = await this.repository.findUserByLogin(
      login.trim().toLowerCase(),
    );
    const passwordMatches = await verifyPassword(
      password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    if (!user || !passwordMatches || !user.isActive) {
      throw invalidCredentials();
    }

    const authUser = toAuthUser(user);
    const refresh = createRefreshSession(user.id);
    await this.repository.createRefreshSession(refresh.session);

    return {
      user: authUser,
      accessToken: createAccessToken(authUser),
      expiresInSeconds: env.JWT_ACCESS_EXPIRES_IN_SECONDS,
      refreshToken: refresh.rawToken,
    };
  }

  public async refresh(rawToken: string): Promise<RefreshResult> {
    const payload = verifyRefreshToken(rawToken);
    const user = await this.repository.findUserById(payload.sub);

    if (!user?.isActive) {
      throw invalidToken();
    }

    const next = createRefreshSession(user.id);
    const rotated = await this.repository.rotateRefreshSession(
      payload.jti,
      hashRefreshToken(rawToken),
      next.session,
    );

    if (!rotated) {
      throw invalidToken();
    }

    return {
      accessToken: createAccessToken(toAuthUser(user)),
      expiresInSeconds: env.JWT_ACCESS_EXPIRES_IN_SECONDS,
      refreshToken: next.rawToken,
    };
  }

  public async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;

    try {
      const payload = verifyRefreshToken(rawToken);
      await this.repository.revokeRefreshSession(
        payload.jti,
        hashRefreshToken(rawToken),
      );
    } catch {
      // Logout remains idempotent for expired, invalid, or revoked cookies.
    }
  }

  public async getCurrentUser(userId: string): Promise<AuthUser> {
    const user = await this.repository.findUserById(userId);

    if (!user?.isActive) {
      throw invalidToken();
    }

    return toAuthUser(user);
  }

  public async listSessions(userId: string): Promise<AuthSession[]> {
    const sessions = await this.repository.listActiveSessions(userId);
    return sessions.map((session) => ({
      id: session.id,
      createdAt: (session.createdAt ?? new Date(0)).toISOString(),
      expiresAt: session.expiresAt.toISOString(),
    }));
  }

  public async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.repository.findUserById(userId);
    if (!user || !user.isActive) {
      throw invalidToken();
    }

    const passwordMatches = await verifyPassword(
      currentPassword,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new ApiError(
        400,
        'INVALID_CURRENT_PASSWORD',
        'Invalid current password',
      );
    }

    const newHash = await hashPassword(newPassword);
    await this.repository.updatePassword(userId, newHash);
  }
}

function createRefreshSession(userId: string): {
  rawToken: string;
  session: NewRefreshSession;
} {
  const id = randomUUID();
  const rawToken = createRefreshToken(userId, id);
  const expiresAt = new Date(
    Date.now() + env.JWT_REFRESH_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1_000,
  );

  return {
    rawToken,
    session: {
      id,
      userId,
      tokenHash: hashRefreshToken(rawToken),
      expiresAt,
    },
  };
}

function toAuthUser(user: AuthUserRecord): AuthUser {
  return {
    id: user.id,
    login: user.login,
    role: user.role,
    teacherId: user.teacherId,
  };
}

function invalidCredentials(): ApiError {
  return new ApiError(401, 'UNAUTHORIZED', 'Invalid login or password');
}

function invalidToken(): ApiError {
  return new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
}
