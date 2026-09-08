import { ApiTeacherSalaryRepository } from './apiTeacherSalary.repository'
import type { TeacherSalaryRepository } from './teacherSalary.repository'

export const teacherSalaryRepository: TeacherSalaryRepository = new ApiTeacherSalaryRepository()
