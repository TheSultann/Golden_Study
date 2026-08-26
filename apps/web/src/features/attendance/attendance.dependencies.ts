import { ApiAttendanceRepository } from './apiAttendance.repository'
import type { AttendanceRepository } from './attendance.repository'

export const attendanceRepository: AttendanceRepository = new ApiAttendanceRepository()
