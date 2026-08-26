import type { Prisma, PrismaClient } from '@prisma/client';

import type {
  AuthRepository,
  AuthRole,
  AuthUserRecord,
  NewRefreshSession,
  RefreshSession,
} from './auth.repository.js';

const userSelect = {
  id: true,
  login: true,
  passwordHash: true,
  role: true,
  teacherId: true,
  isActive: true,
} satisfies Prisma.UserSelect;

function mapAuthRole(role: string): AuthRole {
  if (role === 'SUPER_ADMIN') return 'SUPER_ADMIN'
  if (role === 'TEACHER') return 'TEACHER'
  return 'ADMIN'
}

export class PrismaAuthRepository implements AuthRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async findUserByLogin(login: string): Promise<AuthUserRecord | null> {
    const user = await this.prisma.user.findUnique({
      where: { login },
      select: userSelect,
    });
    if (!user) return null;
    return {
      ...user,
      role: mapAuthRole(user.role),
    };
  }

  public async findUserById(id: string): Promise<AuthUserRecord | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });
    if (!user) return null;
    return {
      ...user,
      role: mapAuthRole(user.role),
    };
  }

  public async createRefreshSession(
    session: NewRefreshSession,
  ): Promise<void> {
    await this.prisma.refreshToken.create({ data: session });
  }

  public rotateRefreshSession(
    currentId: string,
    currentHash: string,
    next: NewRefreshSession,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      const revoked = await transaction.refreshToken.updateMany({
        where: {
          id: currentId,
          tokenHash: currentHash,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { revokedAt: new Date() },
      });

      if (revoked.count !== 1) return false;

      await transaction.refreshToken.create({ data: next });
      await transaction.refreshToken.update({
        where: { id: currentId },
        data: { replacedByTokenId: next.id },
      });
      return true;
    });
  }

  public async revokeRefreshSession(
    id: string,
    tokenHash: string,
  ): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: {
        id,
        tokenHash,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  public listActiveSessions(userId: string): Promise<RefreshSession[]> {
    return this.prisma.refreshToken.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  public async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }
}

