import type { AuthUser } from '@golden-study/contracts';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
