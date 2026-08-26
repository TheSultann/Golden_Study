import { ApiDashboardRepository } from './apiDashboard.repository'
import type { DashboardRepository } from './dashboard.repository'

export const dashboardRepository: DashboardRepository = new ApiDashboardRepository()
