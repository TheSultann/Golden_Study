import { ApiTeacherScheduleRepository } from './apiTeacherSchedule.repository'
import type { TeacherScheduleRepository } from './teacherSchedule.repository'

export const teacherScheduleRepository: TeacherScheduleRepository = new ApiTeacherScheduleRepository()
