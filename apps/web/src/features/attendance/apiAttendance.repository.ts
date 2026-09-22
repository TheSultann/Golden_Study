import {
  type AttendanceBroadcastInput,
  type AttendanceBroadcastResult,
  attendanceBroadcastResultSchema,
  type AttendanceRow,
  type AttendanceSession,
} from '@golden-study/contracts'
import { z } from 'zod'

import { apiRequest } from '../../shared/api/httpClient'
import type { AttendanceRepository } from './attendance.repository'

const broadcastApiResponseSchema = z.object({
  success: z.literal(true),
  data: attendanceBroadcastResultSchema,
})

const apiStatusSchema = z.enum(['CAME', 'EXCUSED', 'ABSENT', 'UNMARKED'])

const apiRowSchema = z.object({
  studentId: z.string(),
  studentCode: z.string().optional().default(''),
  studentName: z.string().optional().default(''),
  status: apiStatusSchema,
  rating: z.number().nullable().optional(),
  homeworkScore: z.number().nullable().optional(),
  topicScore: z.number().nullable().optional(),
  dictionaryScore: z.number().nullable().optional(),
  homeworkDone: z.boolean().optional().default(false),
  comment: z.string().nullable().optional(),
  lockedByAdmin: z.boolean().optional().default(false),
})

const apiSessionSchema = z.object({
  groupId: z.string(),
  groupName: z.string(),
  date: z.string(),
  homeworkText: z.string().optional().default(''),
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
  status: 'CAME' | 'EXCUSED' | 'ABSENT' | 'UNMARKED' | string | null | undefined,
): 'came' | 'excused' | 'absent' | 'unmarked' {
  switch (status) {
    case 'CAME':
      return 'came'
    case 'EXCUSED':
      return 'excused'
    case 'ABSENT':
      return 'absent'
    case 'UNMARKED':
    default:
      return 'unmarked'
  }
}

function mapUiToApiStatus(
  status: 'came' | 'excused' | 'absent' | 'unmarked' | string,
): 'CAME' | 'EXCUSED' | 'ABSENT' {
  switch (status) {
    case 'came':
      return 'CAME'
    case 'excused':
      return 'EXCUSED'
    case 'absent':
      return 'ABSENT'
    case 'unmarked':
    default:
      return 'CAME'
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
      homeworkText: session.homeworkText || '',
      rows: session.rows.map((row): AttendanceRow => {
        const hasSpecific =
          typeof row.homeworkScore === 'number' ||
          typeof row.topicScore === 'number' ||
          typeof row.dictionaryScore === 'number'

        const legacyRating = typeof row.rating === 'number' ? row.rating : null

        return {
          studentId: row.studentId,
          studentCode: row.studentCode || '',
          studentName: row.studentName || '',
          status: mapApiToUiStatus(row.status),
          rating: typeof row.rating === 'number' ? row.rating : null,
          homeworkScore: hasSpecific ? (row.homeworkScore ?? null) : legacyRating,
          topicScore: hasSpecific ? (row.topicScore ?? null) : legacyRating,
          dictionaryScore: hasSpecific ? (row.dictionaryScore ?? null) : legacyRating,
          homeworkDone: Boolean(row.homeworkDone),
          comment: row.comment || '',
          lockedByAdmin: Boolean(row.lockedByAdmin),
        }
      }),
    }
  }

  async save(session: AttendanceSession): Promise<AttendanceSession> {
    const targetGroupId = await this.resolveGroupId(session.groupId)

    // Filter valid UUID students to prevent Zod 400 Bad Request on fake/mock student IDs
    const validRows = session.rows.filter((row) => isUuid(row.studentId))
    const sourceRows = validRows.length > 0 ? validRows : session.rows
    const markedRows = sourceRows.filter((row) => row.status !== 'unmarked')
    const rowsToSave = markedRows.length > 0 ? markedRows : sourceRows

    const payload = {
      groupId: targetGroupId,
      date: session.date,
      homeworkText: session.homeworkText || '',
      items: rowsToSave.map((row) => {
        const apiStatus = mapUiToApiStatus(row.status)
        const isCame = apiStatus === 'CAME'
        const hwScore = isCame
          ? (typeof row.homeworkScore === 'number'
              ? Math.min(100, Math.max(0, row.homeworkScore))
              : null)
          : null
        const topScore = isCame
          ? (typeof row.topicScore === 'number'
              ? Math.min(100, Math.max(0, row.topicScore))
              : null)
          : null
        const dictScore = isCame
          ? (typeof row.dictionaryScore === 'number'
              ? Math.min(100, Math.max(0, row.dictionaryScore))
              : null)
          : null

        const validScores = [hwScore, topScore, dictScore].filter((s): s is number => typeof s === 'number')
        const calculatedRating = isCame
          ? (validScores.length > 0
              ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
              : (typeof row.rating === 'number' ? row.rating : null))
          : null

        return {
          studentId: row.studentId,
          status: apiStatus,
          rating: calculatedRating,
          homeworkScore: hwScore,
          topicScore: topScore,
          dictionaryScore: dictScore,
          homeworkDone: isCame ? (typeof row.homeworkDone === 'boolean' ? row.homeworkDone : (typeof hwScore === 'number' ? hwScore > 0 : false)) : false,
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
      homeworkText: savedSession.homeworkText || '',
      rows: savedSession.rows.map((row): AttendanceRow => {
        const hasSpecific =
          typeof row.homeworkScore === 'number' ||
          typeof row.topicScore === 'number' ||
          typeof row.dictionaryScore === 'number'

        const legacyRating = typeof row.rating === 'number' ? row.rating : null

        return {
          studentId: row.studentId,
          studentCode: row.studentCode || '',
          studentName: row.studentName || '',
          status: mapApiToUiStatus(row.status),
          rating: typeof row.rating === 'number' ? row.rating : null,
          homeworkScore: hasSpecific ? (row.homeworkScore ?? null) : legacyRating,
          topicScore: hasSpecific ? (row.topicScore ?? null) : legacyRating,
          dictionaryScore: hasSpecific ? (row.dictionaryScore ?? null) : legacyRating,
          homeworkDone: Boolean(row.homeworkDone),
          comment: row.comment || '',
          lockedByAdmin: Boolean(row.lockedByAdmin),
        }
      }),
    }
  }

  async broadcast(input: AttendanceBroadcastInput): Promise<AttendanceBroadcastResult> {
    const targetGroupId = await this.resolveGroupId(input.groupId || '')
    const response = await apiRequest(
      `/attendance/group/${targetGroupId}/broadcast`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
      broadcastApiResponseSchema,
    )
    return response.data
  }
}

