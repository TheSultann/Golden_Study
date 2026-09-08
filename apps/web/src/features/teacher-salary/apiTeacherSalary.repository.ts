import { teacherSalaryOverviewResponseSchema, type TeacherSalaryOverview } from '@golden-study/contracts'

import { apiRequest } from '../../shared/api/httpClient'
import type { TeacherSalaryRepository } from './teacherSalary.repository'

export class ApiTeacherSalaryRepository implements TeacherSalaryRepository {
  async getOverview(): Promise<TeacherSalaryOverview> {
    const response = await apiRequest('/teachers/me/salary', { method: 'GET' }, teacherSalaryOverviewResponseSchema)
    return response.data
  }
}
