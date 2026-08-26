import { ApiTeacherAttendanceRepository } from './apiTeacherAttendance.repository'
import type { TeacherAttendanceRepository } from './teacherAttendance.repository'

export const teacherAttendanceRepository: TeacherAttendanceRepository = new ApiTeacherAttendanceRepository()
