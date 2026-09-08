import {
  paginationMetaSchema,
  teacherApiSchema,
  type StaffMember,
  type TeacherApi,
} from '@golden-study/contracts'
import { z } from 'zod'

import { apiRequest, apiRequestVoid } from '../../shared/api/httpClient'
import { mockStaffList } from '../staff/mockStaff.repository'
import type { TeacherRepository } from './teacher.repository'
import type { SalaryType, Teacher } from './teacher.types'

const teacherListApiResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(teacherApiSchema),
  meta: paginationMetaSchema,
})

const teacherApiResponseSchema = z.object({
  success: z.literal(true),
  data: teacherApiSchema,
})

function formatPhone(raw: string): string {
  const digits = raw.replaceAll(/\D/g, '')
  if (digits.startsWith('998') && digits.length === 12) {
    return `+${digits}`
  }
  if (digits.length === 9) {
    return `+998${digits}`
  }
  return raw.trim()
}

function toTeacher(value: TeacherApi): Teacher {
  const salaryTypeMap: Record<TeacherApi['salaryType'], SalaryType> = {
    FIXED: 'fixed',
    PER_STUDENT: 'per_student',
    PERCENT: 'percent',
  }
  const rate =
    value.salaryType === 'FIXED'
      ? (value.fixedSalaryUzs ?? 0)
      : value.salaryType === 'PER_STUDENT'
      ? (value.perStudentRateUzs ?? 0)
      : Math.round((value.kpiRateBasisPoints ?? 0) / 100)

  return {
    id: value.id,
    firstName: value.firstName,
    lastName: value.lastName,
    phone: value.phone,
    salaryType: salaryTypeMap[value.salaryType],
    rate,
    kpiBalance: 0,
    groups: value.groups,
    login: value.login ?? `${value.firstName.toLowerCase()}.${value.lastName.toLowerCase()}`,
    active: value.isActive,
  }
}

function toCreateInput(teacher: Teacher) {
  const salaryTypeMap: Record<SalaryType, 'FIXED' | 'PER_STUDENT' | 'PERCENT'> = {
    fixed: 'FIXED',
    per_student: 'PER_STUDENT',
    percent: 'PERCENT',
  }
  const apiSalaryType = salaryTypeMap[teacher.salaryType]
  return {
    firstName: teacher.firstName,
    lastName: teacher.lastName,
    phone: formatPhone(teacher.phone),
    login: teacher.login,
    password: (teacher as any).password || 'Password123!',
    salaryType: apiSalaryType,
    fixedSalaryUzs: apiSalaryType === 'FIXED' ? teacher.rate : undefined,
    perStudentRateUzs: apiSalaryType === 'PER_STUDENT' ? teacher.rate : undefined,
    kpiRateBasisPoints: apiSalaryType === 'PERCENT' ? teacher.rate * 100 : undefined,
  }
}

function toUpdateInput(teacher: Teacher) {
  const salaryTypeMap: Record<SalaryType, 'FIXED' | 'PER_STUDENT' | 'PERCENT'> = {
    fixed: 'FIXED',
    per_student: 'PER_STUDENT',
    percent: 'PERCENT',
  }
  const apiSalaryType = salaryTypeMap[teacher.salaryType]
  return {
    firstName: teacher.firstName,
    lastName: teacher.lastName,
    phone: formatPhone(teacher.phone),
    login: teacher.login,
    salaryType: apiSalaryType,
    fixedSalaryUzs: apiSalaryType === 'FIXED' ? teacher.rate : undefined,
    perStudentRateUzs: apiSalaryType === 'PER_STUDENT' ? teacher.rate : undefined,
    kpiRateBasisPoints: apiSalaryType === 'PERCENT' ? teacher.rate * 100 : undefined,
    ...((teacher as any).password ? { password: (teacher as any).password } : {}),
  }
}

const localTeachersStore: Teacher[] = []

export class ApiTeacherRepository implements TeacherRepository {
  async list(): Promise<Teacher[]> {
    let serverTeachers: Teacher[] = []
    try {
      const response = await apiRequest(
        '/teachers?limit=100',
        { method: 'GET' },
        teacherListApiResponseSchema,
      )
      serverTeachers = response.data.map(toTeacher)
    } catch {
      serverTeachers = []
    }
    const existingIds = new Set(serverTeachers.map((t) => t.id))
    const merged = [...serverTeachers]
    for (const lt of localTeachersStore) {
      if (!existingIds.has(lt.id) && lt.active) {
        merged.unshift(lt)
      }
    }
    return merged
  }

  async create(teacher: Teacher): Promise<Teacher> {
    try {
      const response = await apiRequest(
        '/teachers',
        { method: 'POST', body: JSON.stringify(toCreateInput(teacher)) },
        teacherApiResponseSchema,
      )
      const created = toTeacher(response.data)

      // Auto-sync created teacher to Xodimlar (mockStaffList)
      const teacherStaffMember: StaffMember = {
        id: `staff-teacher-${created.id}`,
        fullName: `${created.firstName} ${created.lastName}`,
        login: created.login,
        phone: created.phone,
        role: 'teacher',
        position: "O'qituvchi",
        status: 'active',
        linkedTeacherId: created.id,
        linkedTeacherName: `${created.firstName} ${created.lastName}`,
        lastLoginAt: new Date().toISOString(),
        lastSalaryPaidAt: null,
        createdAt: new Date().toISOString(),
        salaryUzs: created.salaryType === 'fixed' ? created.rate : 0,
      }
      const existingStaffIdx = mockStaffList.findIndex((s) => s.login === created.login || s.linkedTeacherId === created.id)
      if (existingStaffIdx !== -1) {
        mockStaffList[existingStaffIdx] = teacherStaffMember
      } else {
        mockStaffList.unshift(teacherStaffMember)
      }

      return created
    } catch (err: any) {
      if (err instanceof Error && (err.message.includes('мавжуд') || err.message.includes('already exists') || err.message.includes('CONFLICT'))) {
        throw new Error('Ushbu login yoki telefon raqami allaqachon mavjud')
      }
      throw err
    }
  }

  async update(teacher: Teacher): Promise<Teacher> {
    let updated: Teacher
    try {
      const response = await apiRequest(
        `/teachers/${teacher.id}`,
        { method: 'PATCH', body: JSON.stringify(toUpdateInput(teacher)) },
        teacherApiResponseSchema,
      )
      updated = toTeacher(response.data)
    } catch (err: any) {
      if (err instanceof Error && (err.message.includes('мавжуд') || err.message.includes('already exists') || err.message.includes('CONFLICT'))) {
        throw new Error('Ushbu login yoki telefon raqami allaqachon mavjud')
      }
      updated = { ...teacher }
    }

    const idx = localTeachersStore.findIndex((t) => t.id === updated.id)
    if (idx !== -1) localTeachersStore[idx] = updated
    else localTeachersStore.unshift(updated)

    return updated
  }

  async setActive(id: string, active: boolean): Promise<Teacher> {
    if (!active) {
      try {
        await apiRequestVoid(`/teachers/${id}`, { method: 'DELETE' })
      } catch {
        // Fallback for offline mode
      }
      const idx = localTeachersStore.findIndex((t) => t.id === id)
      if (idx !== -1) {
        localTeachersStore[idx] = { ...localTeachersStore[idx], active: false }
      }
      return {
        id,
        firstName: '',
        lastName: '',
        phone: '',
        salaryType: 'percent',
        rate: 0,
        kpiBalance: 0,
        groups: [],
        login: '',
        active: false,
      }
    }
    const response = await apiRequest(
      `/teachers/${id}`,
      { method: 'PATCH', body: JSON.stringify({ isActive: true }) },
      teacherApiResponseSchema,
    )
    return toTeacher(response.data)
  }
}
