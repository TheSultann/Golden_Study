import { useQuery } from '@tanstack/react-query'

import { teacherSalaryRepository } from './teacherSalary.dependencies'

export const teacherSalaryKeys = {
  all: ['teacher-salary'] as const,
}

export function useTeacherSalary() {
  return useQuery({
    queryKey: teacherSalaryKeys.all,
    queryFn: () => teacherSalaryRepository.getOverview(),
  })
}
