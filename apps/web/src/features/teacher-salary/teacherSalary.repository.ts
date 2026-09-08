import type { TeacherSalaryOverview } from '@golden-study/contracts'

export interface TeacherSalaryRepository {
  getOverview(): Promise<TeacherSalaryOverview>
}
