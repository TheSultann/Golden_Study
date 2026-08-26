import { teacherScheduleResponseSchema } from '@golden-study/contracts'

import { apiRequest } from '../../shared/api/httpClient'
import type { TeacherScheduleRepository } from './teacherSchedule.repository'

export class ApiTeacherScheduleRepository implements TeacherScheduleRepository {
  async list() {
    const response = await apiRequest('/teachers/me/schedule', { method: 'GET' }, teacherScheduleResponseSchema)
    return response.data
  }
}
