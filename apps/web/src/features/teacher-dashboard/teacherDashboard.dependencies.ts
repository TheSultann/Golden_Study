import { ApiTeacherDashboardRepository } from './apiTeacherDashboard.repository'
import type { TeacherDashboardRepository } from './teacherDashboard.repository'

export const teacherDashboardRepository: TeacherDashboardRepository = new ApiTeacherDashboardRepository()
