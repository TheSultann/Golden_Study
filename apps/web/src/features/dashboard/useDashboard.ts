import { useQuery } from '@tanstack/react-query'

import { dashboardRepository } from './dashboard.dependencies'

export function useDashboard(options?: { enabled?: boolean }) {
  return useQuery({ queryKey: ['dashboard'], queryFn: () => dashboardRepository.get(), ...options })
}
