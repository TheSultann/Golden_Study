import { ApiStudentRepository } from './apiStudent.repository'
import type { StudentRepository } from './student.repository'

export const studentRepository: StudentRepository = new ApiStudentRepository()
