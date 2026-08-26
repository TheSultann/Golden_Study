import { useQuery } from '@tanstack/react-query'
import { teacherScheduleRepository } from './teacherSchedule.dependencies'

export function useTeacherSchedule() {
  return useQuery({ queryKey: ['teacher-schedule'], queryFn: () => teacherScheduleRepository.list() })
}
