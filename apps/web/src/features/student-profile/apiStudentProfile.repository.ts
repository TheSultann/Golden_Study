import {
  studentProfileApiResponseSchema,
  type Student,
  type StudentApi,
  type StudentProfile,
  type StudentProfileApi,
} from '@golden-study/contracts'

import { apiRequest } from '../../shared/api/httpClient'
import type { StudentProfileRepository } from './studentProfile.repository'

function toFrontendStudent(apiStudent: StudentProfileApi['student']): Student {
  const statusMap: Record<StudentApi['status'], Student['status']> = {
    ACTIVE: 'active',
    FROZEN: 'frozen',
    GRADUATE: 'graduate',
    ARCHIVED: 'frozen',
  }

  return {
    id: apiStudent.id,
    code: apiStudent.studentCode,
    firstName: apiStudent.firstName,
    lastName: apiStudent.lastName,
    birthDate: apiStudent.birthDate ?? '',
    phone: apiStudent.phone ?? '',
    parentName: apiStudent.parentName ?? '',
    parentPhone: apiStudent.parentPhone ?? '',
    address: apiStudent.address ?? '',
    status: statusMap[apiStudent.status],
    balance: apiStudent.balanceUzs ?? 0,
    groups: apiStudent.activeGroups.map((g) => g.name),
  }
}

function toFrontendStudentProfile(apiProfile: StudentProfileApi): StudentProfile {
  return {
    student: toFrontendStudent(apiProfile.student),
    academicSummary: apiProfile.academicSummary,
    updatedAt: apiProfile.updatedAt,
  }
}

export class ApiStudentProfileRepository implements StudentProfileRepository {
  async getById(studentId: string): Promise<StudentProfile> {
    const response = await apiRequest(
      `/students/${studentId}/profile`,
      { method: 'GET' },
      studentProfileApiResponseSchema,
    )
    return toFrontendStudentProfile(response.data)
  }
}

