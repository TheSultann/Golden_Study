import type { TeacherDashboard } from '@golden-study/contracts'

export interface TeacherDashboardRepository {
  get(): Promise<TeacherDashboard>
}
