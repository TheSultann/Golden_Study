import {
  courseApiSchema,
  groupApiSchema,
  paginationMetaSchema,
  teacherApiSchema,
  roomApiSchema,
  type Group,
  type GroupApi,
} from '@golden-study/contracts'
import { z } from 'zod'


import { apiRequest } from '../../shared/api/httpClient'

import type { GroupRepository } from './group.repository'

const groupListApiResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(groupApiSchema),
  meta: paginationMetaSchema,
})

const groupApiResponseSchema = z.object({
  success: z.literal(true),
  data: groupApiSchema,
})

const courseListApiResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(courseApiSchema),
  meta: paginationMetaSchema,
})

const courseApiResponseSchema = z.object({
  success: z.literal(true),
  data: courseApiSchema,
})

const teacherListApiResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(teacherApiSchema),
  meta: paginationMetaSchema,
})

const teacherApiResponseSchema = z.object({
  success: z.literal(true),
  data: teacherApiSchema,
})

const roomListApiResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(roomApiSchema),
  meta: paginationMetaSchema,
})

const roomApiResponseSchema = z.object({
  success: z.literal(true),
  data: roomApiSchema,
})

async function resolveRoomId(roomName: string): Promise<string | null> {
  const trimmed = roomName.trim()
  if (!trimmed || trimmed.toLowerCase() === 'xona berilmagan' || trimmed.toLowerCase() === 'xona tanlanmagan') return null
  const res = await apiRequest('/rooms?limit=100', { method: 'GET' }, roomListApiResponseSchema)
  const found = res.data.find((r) => r.name.toLowerCase() === trimmed.toLowerCase())
  if (found) return found.id

  try {
    const created = await apiRequest(
      '/rooms',
      {
        method: 'POST',
        body: JSON.stringify({
          name: trimmed,
        }),
      },
      roomApiResponseSchema,
    )
    return created.data.id
  } catch (err) {
    console.error('Failed to resolve room:', err)
    return null
  }
}

async function resolveCourseId(courseTitle: string): Promise<string> {
  const res = await apiRequest('/courses?limit=100', { method: 'GET' }, courseListApiResponseSchema)
  const found = res.data.find((c) => c.title.toLowerCase() === courseTitle.toLowerCase())
  if (found) return found.id

  const created = await apiRequest(
    '/courses',
    {
      method: 'POST',
      body: JSON.stringify({
        title: courseTitle,
        description: courseTitle,
        durationMonths: 6,
        pricePerMonthUzs: 600000,
      }),
    },
    courseApiResponseSchema,
  )
  return created.data.id
}

async function resolveTeacherId(teacherName: string): Promise<string> {
  const res = await apiRequest('/teachers?limit=100', { method: 'GET' }, teacherListApiResponseSchema)
  const found = res.data.find((t) => `${t.firstName} ${t.lastName}`.toLowerCase() === teacherName.toLowerCase())
  if (found) return found.id
  if (res.data.length > 0) return res.data[0].id

  const parts = teacherName.trim().split(/\s+/)
  const firstName = parts[0] || 'O‘qituvchi'
  const lastName = parts.slice(1).join(' ') || 'Ustoz'

  const created = await apiRequest(
    '/teachers',
    {
      method: 'POST',
      body: JSON.stringify({
        firstName,
        lastName,
        phone: '+998901234567',
        login: `teacher.${Date.now().toString().slice(-4)}`,
        password: 'Password123!',
        salaryType: 'PERCENT',
        kpiRateBasisPoints: 5000,
      }),
    },
    teacherApiResponseSchema,
  )
  return created.data.id
}

function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 540
  const [h, m] = timeStr.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return 540
  return h * 60 + m
}

function mapWeekdays(days: string[]): Array<'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN'> {
  const map: Record<string, 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN'> = {
    Du: 'MON',
    Se: 'TUE',
    Chor: 'WED',
    Pay: 'THU',
    Ju: 'FRI',
    Sha: 'SAT',
    Yak: 'SUN',
  }
  const result = days.map((d) => map[d] ?? (['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].includes(d) ? (d as any) : 'MON'))
  const unique = Array.from(new Set(result))
  return unique.length > 0 ? unique : ['MON', 'WED', 'FRI']
}

function toFrontendGroup(apiGroup: GroupApi): Group {
  const startHour = Math.floor(apiGroup.lessonStartMinutes / 60).toString().padStart(2, '0')
  const startMinute = (apiGroup.lessonStartMinutes % 60).toString().padStart(2, '0')

  const weekdayReverseMap: Record<string, string> = {
    MON: 'Du',
    TUE: 'Se',
    WED: 'Chor',
    THU: 'Pay',
    FRI: 'Ju',
    SAT: 'Sha',
    SUN: 'Yak',
  }

  return {
    id: apiGroup.id,
    name: apiGroup.name,
    course: apiGroup.courseTitle,
    teacher: apiGroup.teacherName,
    weekdays: apiGroup.weekdays.map((d) => weekdayReverseMap[d] ?? d),
    time: `${startHour}:${startMinute}`,
    room: apiGroup.roomName ?? 'Xona berilmagan',
    startDate: apiGroup.startDate,
    endDate: apiGroup.endDate,
    activeStudents: apiGroup.studentsCount,
    graduateStudents: 0,
    active: apiGroup.status === 'ACTIVE',
    telegramChatId: apiGroup.telegramChatId ?? null,
    telegramChatTitle: apiGroup.telegramChatTitle ?? null,
  }
}

export class ApiGroupRepository implements GroupRepository {
  async list(): Promise<Group[]> {
    const response = await apiRequest(
      '/groups?limit=100',
      { method: 'GET' },
      groupListApiResponseSchema,
    )
    return response.data.map(toFrontendGroup)
  }

  async save(group: Group): Promise<Group> {
    const isNew = !group.id || group.id.startsWith('new-') || group.id.startsWith('g-')
    const courseId = await resolveCourseId(group.course)
    const teacherId = await resolveTeacherId(group.teacher)
    const roomId = await resolveRoomId(group.room)

    const payload = {
      name: group.name.trim(),
      courseId,
      teacherId,
      roomId,
      weekdays: mapWeekdays(group.weekdays),
      lessonStartMinutes: timeToMinutes(group.time),
      lessonDurationMinutes: 90,
      startDate: group.startDate || new Date().toISOString().slice(0, 10),
    }

    if (isNew) {
      const response = await apiRequest(
        '/groups',
        { method: 'POST', body: JSON.stringify(payload) },
        groupApiResponseSchema,
      )
      return toFrontendGroup(response.data)
    }

    const response = await apiRequest(
      `/groups/${group.id}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
      groupApiResponseSchema,
    )
    return toFrontendGroup(response.data)
  }

  async setActive(id: string, active: boolean): Promise<Group> {
    const status = active ? 'ACTIVE' : 'COMPLETED'
    const response = await apiRequest(
      `/groups/${id}/status`,
      { method: 'PATCH', body: JSON.stringify({ status }) },
      groupApiResponseSchema,
    )
    return toFrontendGroup(response.data)
  }

  async unlinkTelegram(id: string): Promise<Group> {
    const response = await apiRequest(
      `/groups/${id}/unlink-telegram`,
      { method: 'POST' },
      groupApiResponseSchema,
    )
    return toFrontendGroup(response.data)
  }
}


