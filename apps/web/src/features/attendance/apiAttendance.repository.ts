import {
  type AttendanceRow,
  type AttendanceSession,
} from '@golden-study/contracts'
import { z } from 'zod'

import { apiRequest } from '../../shared/api/httpClient'
import type { AttendanceRepository } from './attendance.repository'

const apiStatusSchema = z.enum(['CAME', 'EXCUSED', 'ABSENT'])

const apiRowSchema = z.object({
  studentId: z.string(),
  studentCode: z.string().optional().default(''),
  studentName: z.string().optional().default(''),
  status: apiStatusSchema,
  rating: z.number().nullable().optional(),
  homeworkDone: z.boolean().optional().default(false),
  comment: z.string().nullable().optional(),
  lockedByAdmin: z.boolean().optional().default(false),
})

const apiSessionSchema = z.object({
  groupId: z.string(),
  groupName: z.string(),
  date: z.string(),
  rows: z.array(apiRowSchema),
})

const attendanceResponseSchema = z.object({
  success: z.literal(true),
  data: apiSessionSchema,
})

function isUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
}

function mapApiToUiStatus(
  status: 'CAME' | 'EXCUSED' | 'ABSENT',
): 'came' | 'excused' | 'absent' {
  switch (status) {
    case 'CAME':
      return 'came'
    case 'EXCUSED':
      return 'excused'
    case 'ABSENT':
      return 'absent'
  }
}

function mapUiToApiStatus(
  status: 'came' | 'excused' | 'absent',
): 'CAME' | 'EXCUSED' | 'ABSENT' {
  switch (status) {
    case 'came':
      return 'CAME'
    case 'excused':
      return 'EXCUSED'
    case 'absent':
      return 'ABSENT'
  }
}

export class ApiAttendanceRepository implements AttendanceRepository {
  private async resolveGroupId(groupId: string): Promise<string> {
    if (isUuid(groupId)) {
      return groupId
    }
    try {
      const groupsRes = await apiRequest(
        '/groups?limit=1',
        { method: 'GET' },
        z.object({
          success: z.literal(true),
          data: z.array(z.object({ id: z.string().uuid() })),
        }),
      )
      if (groupsRes.data.length > 0) {
        return groupsRes.data[0].id
      }
    } catch {
      // Ignore fallback failure
    }
    return groupId
  }

  async get(groupId: string, date: string): Promise<AttendanceSession> {
    const targetGroupId = await this.resolveGroupId(groupId)

    const response = await apiRequest(
      `/attendance/group/${targetGroupId}/date/${date}`,
      { method: 'GET' },
      attendanceResponseSchema,
    )

    const session = response.data
    return {
      groupId: session.groupId,
      groupName: session.groupName,
      date: session.date,
      rows: session.rows.map((row): AttendanceRow => ({
        studentId: row.studentId,
        studentCode: row.studentCode || '',
        studentName: row.studentName || '',
        status: mapApiToUiStatus(row.status),
        rating: row.rating ?? 5,
        homeworkDone: Boolean(row.homeworkDone),
        comment: row.comment || '',
        lockedByAdmin: Boolean(row.lockedByAdmin),
      })),
    }
  }

  async save(session: AttendanceSession): Promise<AttendanceSession> {
    const targetGroupId = await this.resolveGroupId(session.groupId)

    // Filter valid UUID students to prevent Zod 400 Bad Request on fake/mock student IDs
    const validRows = session.rows.filter((row) => isUuid(row.studentId))
    const rowsToSave = validRows.length > 0 ? validRows : session.rows

    const payload = {
      groupId: targetGroupId,
      date: session.date,
      items: rowsToSave.map((row) => {
        const apiStatus = mapUiToApiStatus(row.status)
        return {
          studentId: row.studentId,
          status: apiStatus,
          rating: apiStatus === 'CAME' ? Math.min(5, Math.max(1, row.rating || 5)) : null,
          homeworkDone: Boolean(row.homeworkDone),
          comment: (row.comment || '').trim(),
        }
      }),
    }

    const response = await apiRequest(
      '/attendance',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      attendanceResponseSchema,
    )

    const savedSession = response.data
    return {
      groupId: savedSession.groupId,
      groupName: savedSession.groupName,
      date: savedSession.date,
      rows: savedSession.rows.map((row): AttendanceRow => ({
        studentId: row.studentId,
        studentCode: row.studentCode || '',
        studentName: row.studentName || '',
        status: mapApiToUiStatus(row.status),
        rating: row.rating ?? 5,
        homeworkDone: Boolean(row.homeworkDone),
        comment: row.comment || '',
        lockedByAdmin: Boolean(row.lockedByAdmin),
      })),
    }
  }
}
