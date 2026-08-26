import { ApiStaffRepository } from './apiStaff.repository'
import type { StaffRepository } from './staff.repository'

export const staffRepository: StaffRepository = new ApiStaffRepository()
