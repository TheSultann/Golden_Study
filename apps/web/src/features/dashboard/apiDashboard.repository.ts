import { dashboardResponseSchema } from '@golden-study/contracts'

import { apiRequest } from '../../shared/api/httpClient'
import type { DashboardRepository } from './dashboard.repository'

export class ApiDashboardRepository implements DashboardRepository {
  async get() {
    const response = await apiRequest(
      '/dashboard',
      { method: 'GET' },
      dashboardResponseSchema,
    )
    return response.data
  }
}
