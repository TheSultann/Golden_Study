import { ApiTeacherExamsRepository } from './apiTeacherExams.repository'
import type { TeacherExamsRepository } from './teacherExams.repository'

export const teacherExamsRepository: TeacherExamsRepository = new ApiTeacherExamsRepository()
