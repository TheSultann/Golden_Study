import { useQuery } from '@tanstack/react-query'

import { getSession } from '../auth/auth.service'
import { teacherSalaryRepository } from './teacherSalary.dependencies'

export const teacherSalaryKeys = {
  all: ['teacher-salary'] as const,
  user: (userId?: string) => ['teacher-salary', userId ?? 'me'] as const,
}

export function useTeacherSalary() {
  const session = getSession()
  return useQuery({
    queryKey: teacherSalaryKeys.user(session?.id),
    queryFn: () => teacherSalaryRepository.getOverview(),
  })
}

