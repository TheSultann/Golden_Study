import type { AuthRole } from '@golden-study/contracts';
export type { AuthRole };

export interface AuthUserRecord {
  id: string;
  login: string;
  passwordHash: string;
  role: AuthRole;
  teacherId: string | null;
  isActive: boolean;
}

export interface NewRefreshSession {
  id: string;
  tokenHash: string;
  userId: string;
  expiresAt: Date;
}

export interface RefreshSession extends NewRefreshSession {
  revokedAt: Date | null;
  replacedByTokenId?: string | null;
  createdAt?: Date;
}

export interface AuthRepository {
  findUserByLogin(login: string): Promise<AuthUserRecord | null>;
  findUserById(id: string): Promise<AuthUserRecord | null>;
  createRefreshSession(session: NewRefreshSession): Promise<void>;
  rotateRefreshSession(
    currentId: string,
    currentHash: string,
    next: NewRefreshSession,
  ): Promise<boolean>;
  revokeRefreshSession(id: string, tokenHash: string): Promise<void>;
  listActiveSessions(userId: string): Promise<RefreshSession[]>;
  updatePassword(userId: string, passwordHash: string): Promise<void>;
}
