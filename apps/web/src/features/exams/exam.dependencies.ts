import { ApiExamRepository } from './apiExam.repository'
import type { ExamRepository } from './exam.repository'

export const examRepository: ExamRepository = new ApiExamRepository()
