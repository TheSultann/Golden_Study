import { useQuery } from '@tanstack/react-query'
import { studentProfileRepository } from './studentProfile.dependencies'

export const studentProfileKey = (studentId: string) => ['student-profile', studentId] as const

export function useStudentProfile(studentId: string | null) {
  return useQuery({
    queryKey: studentProfileKey(studentId ?? ''),
    queryFn: () => studentProfileRepository.getById(studentId!),
    enabled: Boolean(studentId),
    staleTime: 0,
    refetchOnMount: 'always',
  })
}
