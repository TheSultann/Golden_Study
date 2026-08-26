import { teacherDashboardResponseSchema } from '@golden-study/contracts'

import { apiRequest } from '../../shared/api/httpClient'
import type { TeacherDashboardRepository } from './teacherDashboard.repository'

export class ApiTeacherDashboardRepository implements TeacherDashboardRepository {
  async get() {
    const response = await apiRequest('/teachers/me/dashboard', { method: 'GET' }, teacherDashboardResponseSchema)
    return response.data
  }
}
