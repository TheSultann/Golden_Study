import { ApiTeacherRepository } from './apiTeacher.repository'
import type { TeacherRepository } from './teacher.repository'

export const teacherRepository: TeacherRepository = new ApiTeacherRepository()
