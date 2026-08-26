import type { DashboardData } from '@golden-study/contracts'

export interface DashboardRepository {
  get(): Promise<DashboardData>
}
