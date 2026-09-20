import {
  type AttendanceBroadcastInput,
  type AttendanceBroadcastResult,
  attendanceBroadcastResultSchema,
  attendanceResponseSchema,
  teacherAttendanceGroupsResponseSchema,
  type AttendanceSession,
} from '@golden-study/contracts'
import { z } from 'zod'

import { apiRequest } from '../../shared/api/httpClient'
import type { TeacherAttendanceRepository } from './teacherAttendance.repository'

const broadcastApiResponseSchema = z.object({
  success: z.literal(true),
  data: attendanceBroadcastResultSchema,
})

export class ApiTeacherAttendanceRepository implements TeacherAttendanceRepository {
  async listGroups() {
    const response = await apiRequest('/teachers/me/attendance/groups', { method: 'GET' }, teacherAttendanceGroupsResponseSchema)
    return response.data
  }

  async get(groupId: string, date: string) {
    const response = await apiRequest(
      `/teachers/me/attendance?groupId=${encodeURIComponent(groupId)}&date=${encodeURIComponent(date)}`,
      { method: 'GET' },
      attendanceResponseSchema,
    )
    return response.data
  }

  async save(session: AttendanceSession) {
    const response = await apiRequest(
      '/teachers/me/attendance',
      { method: 'PUT', body: JSON.stringify(session) },
      attendanceResponseSchema,
    )
    return response.data
  }

  async broadcast(input: AttendanceBroadcastInput): Promise<AttendanceBroadcastResult> {
    const response = await apiRequest(
      `/attendance/group/${input.groupId}/broadcast`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
      broadcastApiResponseSchema,
    )
    return response.data
  }
}
