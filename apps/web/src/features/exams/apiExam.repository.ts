import { examListResponseSchema, examResponseSchema, type Exam } from '@golden-study/contracts'
import { z } from 'zod'

import { apiRequest } from '../../shared/api/httpClient'
import type { ExamRepository } from './exam.repository'

export class ApiExamRepository implements ExamRepository {
  async list() {
    const response = await apiRequest('/exams', { method: 'GET' }, examListResponseSchema)
    return response.data
  }

  async save(exam: Exam) {
    const response = await apiRequest(
      `/exams/${exam.id}`,
      { method: 'PUT', body: JSON.stringify(exam) },
      examResponseSchema,
    )
    return response.data
  }

  async delete(id: string) {
    await apiRequest(`/exams/${id}`, { method: 'DELETE' }, z.any())
  }
}
