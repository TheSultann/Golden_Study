import type { AuthUser } from '@golden-study/contracts';
import { beforeEach, describe, expect, it } from 'vitest';

import type { ApiError } from '../../common/errors/api-error.js';
import type {
  AuthRepository,
  AuthUserRecord,
  NewRefreshSession,
  RefreshSession,
} from './auth.repository.js';
import { AuthService } from './auth.service.js';
import { hashPassword } from './password.service.js';

class MemoryAuthRepository implements AuthRepository {
  public users: AuthUserRecord[] = [];
  public sessions: RefreshSession[] = [];

  public findUserByLogin(login: string): Promise<AuthUserRecord | null> {
    return Promise.resolve(
      this.users.find((user) => user.login === login) ?? null,
    );
  }

  public findUserById(id: string): Promise<AuthUserRecord | null> {
    return Promise.resolve(this.users.find((user) => user.id === id) ?? null);
  }

  public createRefreshSession(session: NewRefreshSession): Promise<void> {
    this.sessions.push({ ...session, revokedAt: null });
    return Promise.resolve();
  }

  public rotateRefreshSession(
    currentId: string,
    currentHash: string,
    next: NewRefreshSession,
  ): Promise<boolean> {
    const current = this.sessions.find(
      (session) =>
        session.id === currentId &&
        session.tokenHash === currentHash &&
        session.revokedAt === null,
    );

    if (!current) {
      return Promise.resolve(false);
    }

    current.revokedAt = new Date();
    current.replacedByTokenId = next.id;
    this.sessions.push({ ...next, revokedAt: null });
    return Promise.resolve(true);
  }

  public revokeRefreshSession(
    id: string,
    tokenHash: string,
  ): Promise<void> {
    const session = this.sessions.find(
      (item) => item.id === id && item.tokenHash === tokenHash,
    );
    if (session) session.revokedAt = new Date();
    return Promise.resolve();
  }

  public listActiveSessions(userId: string): Promise<RefreshSession[]> {
    return Promise.resolve(
      this.sessions.filter(
        (session) =>
          session.userId === userId &&
          session.revokedAt === null &&
          session.expiresAt > new Date(),
      ),
    );
  }

  public updatePassword(userId: string, passwordHash: string): Promise<void> {
    const user = this.users.find((u) => u.id === userId);
    if (user) {
      user.passwordHash = passwordHash;
    }
    return Promise.resolve();
  }
}

const baseUser: Omit<AuthUserRecord, 'passwordHash'> = {
  id: '11111111-1111-4111-8111-111111111111',
  login: 'admin',
  role: 'ADMIN',
  teacherId: null,
  isActive: true,
};

describe('AuthService', () => {
  let repository: MemoryAuthRepository;
  let service: AuthService;

  beforeEach(async () => {
    repository = new MemoryAuthRepository();
    repository.users.push({
      ...baseUser,
      passwordHash: await hashPassword('password123'),
    });
    service = new AuthService(repository);
  });

  it('logs in an active user and creates a refresh session', async () => {
    const result = await service.login('admin', 'password123');

    expect(result.user).toEqual<AuthUser>({
      id: baseUser.id,
      login: 'admin',
      role: 'ADMIN',
      teacherId: null,
    });
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(repository.sessions).toHaveLength(1);
    expect(repository.sessions[0]?.tokenHash).not.toBe(result.refreshToken);
  });

  it.each([
    ['missing', 'password123'],
    ['admin', 'wrong-password'],
  ])('returns one generic error for invalid credentials', async (login, password) => {
    await expect(service.login(login, password)).rejects.toMatchObject({
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: 'Invalid login or password',
    } satisfies Partial<ApiError>);
  });

  it('rejects an inactive user', async () => {
    repository.users[0] = { ...repository.users[0]!, isActive: false };

    await expect(service.login('admin', 'password123')).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('rotates refresh token and rejects replay of the previous token', async () => {
    const login = await service.login('admin', 'password123');
    const refreshed = await service.refresh(login.refreshToken);

    expect(refreshed.refreshToken).not.toBe(login.refreshToken);
    await expect(service.refresh(login.refreshToken)).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('logs out idempotently', async () => {
    const login = await service.login('admin', 'password123');

    await service.logout(login.refreshToken);
    await service.logout(login.refreshToken);

    expect(repository.sessions[0]?.revokedAt).toBeInstanceOf(Date);
  });

  it('changes password successfully and allows login with new password', async () => {
    await service.changePassword(baseUser.id, 'password123', 'newpassword456');

    await expect(service.login('admin', 'password123')).rejects.toThrow();
    const loginResult = await service.login('admin', 'newpassword456');
    expect(loginResult.user.id).toBe(baseUser.id);
  });

  it('rejects password change with wrong current password', async () => {
    await expect(
      service.changePassword(baseUser.id, 'wrongcurrent', 'newpassword456'),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_CURRENT_PASSWORD',
    });
  });
});
