import { studentProfileResponseSchema } from '@golden-study/contracts'

import { apiRequest } from '../../shared/api/httpClient'
import type { StudentProfileRepository } from './studentProfile.repository'

export class ApiStudentProfileRepository implements StudentProfileRepository {
  async getById(studentId: string) {
    const response = await apiRequest(
      `/students/${studentId}/profile`,
      { method: 'GET' },
      studentProfileResponseSchema,
    )
    return response.data
  }
}
