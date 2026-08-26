import { teacherRatingResponseSchema } from '@golden-study/contracts'

import { apiRequest } from '../../shared/api/httpClient'
import type { TeacherRatingRepository } from './teacherRating.repository'

export class ApiTeacherRatingRepository implements TeacherRatingRepository {
  async list() {
    const response = await apiRequest('/teachers/me/rating', { method: 'GET' }, teacherRatingResponseSchema)
    return response.data
  }
}
