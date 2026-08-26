import {
  paginationMetaSchema,
  studentApiSchema,
  groupApiSchema,
  type Student,
  type StudentApi,
} from '@golden-study/contracts'
import { z } from 'zod'

import { apiRequest } from '../../shared/api/httpClient'
import type { StudentRepository } from './student.repository'

const studentListApiResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(studentApiSchema),
  meta: paginationMetaSchema,
})

const groupListApiResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(groupApiSchema),
})


const studentApiResponseSchema = z.object({
  success: z.literal(true),
  data: studentApiSchema,
})

function cleanPhone(raw: string | undefined | null): string | null {
  if (!raw) return null
  const digits = raw.replaceAll(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('998')) {
    return `+${digits}`
  }
  if (digits.length === 9) {
    return `+998${digits}`
  }
  return null
}

function cleanString(raw: string | undefined | null): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}

function cleanDate(raw: string | undefined | null): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  return null
}

function toFrontendStudent(apiStudent: StudentApi): Student {
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
    balance: 0,
    groups: apiStudent.activeGroups.map((g) => g.name),
  }
}

export class ApiStudentRepository implements StudentRepository {
  async list(): Promise<Student[]> {
    const response = await apiRequest(
      '/students?limit=100',
      { method: 'GET' },
      studentListApiResponseSchema,
    )
    return response.data.filter((item) => item.status !== 'ARCHIVED').map(toFrontendStudent)
  }

  async save(student: Student): Promise<Student> {
    const isNew = !student.id || student.id.startsWith('new-') || student.id.startsWith('s-')
    const payload = {
      firstName: student.firstName.trim(),
      lastName: student.lastName.trim(),
      birthDate: cleanDate(student.birthDate),
      phone: cleanPhone(student.phone),
      address: cleanString(student.address),
      parentName: cleanString(student.parentName),
      parentPhone: cleanPhone(student.parentPhone),
    }

    let savedApiStudent;
    if (isNew) {
      const response = await apiRequest(
        '/students',
        { method: 'POST', body: JSON.stringify(payload) },
        studentApiResponseSchema,
      )
      savedApiStudent = response.data
    } else {
      const response = await apiRequest(
        `/students/${student.id}`,
        { method: 'PATCH', body: JSON.stringify(payload) },
        studentApiResponseSchema,
      )
      savedApiStudent = response.data
    }

    // Обрабатываем привязку групп
    const groupsRes = await apiRequest('/groups?limit=100', { method: 'GET' }, groupListApiResponseSchema)
    const newGroupNames = student.groups || []
    const currentGroupNames = (savedApiStudent.activeGroups || []).map((g: any) => g.name)

    // Добавляем новые группы
    for (const groupName of newGroupNames) {
      if (!currentGroupNames.includes(groupName)) {
        const targetGroup = groupsRes.data.find((g: any) => g.name === groupName)
        if (targetGroup) {
          await apiRequest(
            `/groups/${targetGroup.id}/students`,
            { method: 'POST', body: JSON.stringify({ studentId: savedApiStudent.id }) },
            z.any()
          )
        }
      }
    }

    // Удаляем из снятых групп
    for (const groupName of currentGroupNames) {
      if (!newGroupNames.includes(groupName)) {
        const targetGroup = groupsRes.data.find((g: any) => g.name === groupName)
        if (targetGroup) {
          await apiRequest(
            `/groups/${targetGroup.id}/students/${savedApiStudent.id}`,
            { method: 'DELETE' },
            z.any()
          )
        }
      }
    }

    // Перезагружаем ученика с обновленными связями
    const updatedResponse = await apiRequest(
      `/students/${savedApiStudent.id}`,
      { method: 'GET' },
      studentApiResponseSchema
    )
    return toFrontendStudent(updatedResponse.data)
  }


  async setStatus(id: string, status: Student['status']): Promise<Student> {
    if (status === 'frozen') {
      const response = await apiRequest(
        `/students/${id}/freeze`,
        { method: 'PATCH' },
        studentApiResponseSchema,
      )
      return toFrontendStudent(response.data)
    }

    if (status === 'active') {
      const response = await apiRequest(
        `/students/${id}/unfreeze`,
        { method: 'PATCH' },
        studentApiResponseSchema,
      )
      return toFrontendStudent(response.data)
    }

    const apiStatus = (status as string) === 'active' ? 'ACTIVE' : (status as string) === 'frozen' ? 'FROZEN' : 'GRADUATE'
    const response = await apiRequest(
      `/students/${id}/status`,
      { method: 'PATCH', body: JSON.stringify({ status: apiStatus }) },
      studentApiResponseSchema,
    )
    return toFrontendStudent(response.data)
  }

  async delete(id: string): Promise<void> {
    await apiRequest(
      `/students/${id}`,
      { method: 'DELETE' },
      z.any()
    )
  }
}

