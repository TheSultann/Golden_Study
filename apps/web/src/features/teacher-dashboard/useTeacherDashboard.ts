import { useQuery } from '@tanstack/react-query'
import { getSession } from '../auth/auth.service'
import { teacherDashboardRepository } from './teacherDashboard.dependencies'

export function useTeacherDashboard(options?: { enabled?: boolean }) {
  const session = getSession()
  return useQuery({
    queryKey: ['teacher-dashboard', session?.id ?? 'me'],
    queryFn: () => teacherDashboardRepository.get(),
    ...options
  })
}
