import type { Exam } from '@golden-study/contracts'

export interface ExamRepository {
  list(): Promise<Exam[]>
  save(exam: Exam): Promise<Exam>
  delete(id: string): Promise<void>
}
