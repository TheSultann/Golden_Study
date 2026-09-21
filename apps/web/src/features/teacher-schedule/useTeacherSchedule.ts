import { useQuery } from '@tanstack/react-query'
import { getSession } from '../auth/auth.service'
import { teacherScheduleRepository } from './teacherSchedule.dependencies'

export function useTeacherSchedule() {
  const session = getSession()
  return useQuery({ queryKey: ['teacher-schedule', session?.id ?? 'me'], queryFn: () => teacherScheduleRepository.list() })
}
