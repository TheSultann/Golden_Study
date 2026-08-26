import type { StudentProfile } from '@golden-study/contracts'

export interface StudentProfileRepository {
  getById(studentId: string): Promise<StudentProfile>
}
