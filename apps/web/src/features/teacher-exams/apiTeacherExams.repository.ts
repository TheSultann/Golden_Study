import { examListResponseSchema, examResponseSchema, teacherExamGroupsResponseSchema, type Exam } from '@golden-study/contracts'
import { z } from 'zod'

import { apiRequest } from '../../shared/api/httpClient'
import type { TeacherExamsRepository } from './teacherExams.repository'

export class ApiTeacherExamsRepository implements TeacherExamsRepository {
  async list() {
    const response = await apiRequest('/teachers/me/exams', { method: 'GET' }, examListResponseSchema)
    return response.data
  }

  async listGroups() {
    const response = await apiRequest('/teachers/me/exams/groups', { method: 'GET' }, teacherExamGroupsResponseSchema)
    return response.data
  }

  async save(exam: Exam) {
    const response = await apiRequest(
      `/teachers/me/exams/${exam.id}`,
      { method: 'PUT', body: JSON.stringify(exam) },
      examResponseSchema,
    )
    return response.data
  }

  async delete(id: string) {
    await apiRequest(`/teachers/me/exams/${id}`, { method: 'DELETE' }, z.any())
  }
}
