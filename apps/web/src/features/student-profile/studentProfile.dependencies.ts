import { ApiStudentProfileRepository } from './apiStudentProfile.repository'
import type { StudentProfileRepository } from './studentProfile.repository'

export const studentProfileRepository: StudentProfileRepository = new ApiStudentProfileRepository()
