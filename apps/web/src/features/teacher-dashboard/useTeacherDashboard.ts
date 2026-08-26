import { useQuery } from '@tanstack/react-query'
import { teacherDashboardRepository } from './teacherDashboard.dependencies'

export function useTeacherDashboard(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['teacher-dashboard'],
    queryFn: () => teacherDashboardRepository.get(),
    ...options
  })
}
