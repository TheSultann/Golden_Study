import type { AuthUser } from '@golden-study/contracts';

import { ApiError } from '../../common/errors/api-error.js';

export function assertTeacherOwnership(
  currentUser: AuthUser,
  resourceTeacherId: string,
): void {
  if (
    currentUser.role === 'TEACHER' &&
    currentUser.teacherId !== resourceTeacherId
  ) {
    throw new ApiError(403, 'FORBIDDEN', 'Access denied');
  }
}
