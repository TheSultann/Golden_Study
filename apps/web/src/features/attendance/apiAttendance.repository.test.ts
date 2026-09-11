import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiAttendanceRepository } from './apiAttendance.repository'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const mockSessionApi = {
  groupId: '11111111-1111-4111-8111-111111111111',
  groupName: 'ENG-101',
  date: '2026-07-21',
  rows: [
    {
      studentId: '22222222-2222-4222-8222-222222222222',
      studentCode: 'ST101',
      studentName: 'Ali Valiyev',
      status: 'CAME' as const,
      rating: 95,
      homeworkDone: true,
      comment: 'Yaxshi',
      lockedByAdmin: false,
    },
  ],
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ApiAttendanceRepository', () => {
  it('fetches and maps attendance session from API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: mockSessionApi,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const repo = new ApiAttendanceRepository()
    const result = await repo.get(mockSessionApi.groupId, mockSessionApi.date)

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`/attendance/group/${mockSessionApi.groupId}/date/${mockSessionApi.date}`),
      expect.objectContaining({ method: 'GET' }),
    )
    expect(result).toEqual({
      groupId: mockSessionApi.groupId,
      groupName: mockSessionApi.groupName,
      date: mockSessionApi.date,
      rows: [
        {
          studentId: '22222222-2222-4222-8222-222222222222',
          studentCode: 'ST101',
          studentName: 'Ali Valiyev',
          status: 'came',
          rating: 95,
          homeworkDone: true,
          comment: 'Yaxshi',
          lockedByAdmin: false,
        },
      ],
    })
  })

  it('saves attendance session to API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: mockSessionApi,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const repo = new ApiAttendanceRepository()
    const result = await repo.save({
      groupId: mockSessionApi.groupId,
      groupName: mockSessionApi.groupName,
      date: mockSessionApi.date,
      rows: [
        {
          studentId: '22222222-2222-4222-8222-222222222222',
          studentCode: 'ST101',
          studentName: 'Ali Valiyev',
          status: 'came',
          rating: 95,
          homeworkDone: true,
          comment: 'Yaxshi',
          lockedByAdmin: false,
        },
      ],
    })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/attendance'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          groupId: mockSessionApi.groupId,
          date: mockSessionApi.date,
          items: [
            {
              studentId: '22222222-2222-4222-8222-222222222222',
              status: 'CAME',
              rating: 95,
              homeworkDone: true,
              comment: 'Yaxshi',
            },
          ],
        }),
      }),
    )
    expect(result.rows[0].status).toBe('came')
  })

  it('correctly preserves rating 0 for came status and sets null for absent', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          ...mockSessionApi,
          rows: [
            { ...mockSessionApi.rows[0], rating: 0, status: 'CAME' },
          ],
        },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const repo = new ApiAttendanceRepository()
    const result = await repo.save({
      groupId: mockSessionApi.groupId,
      groupName: mockSessionApi.groupName,
      date: mockSessionApi.date,
      rows: [
        {
          studentId: '22222222-2222-4222-8222-222222222222',
          studentCode: 'ST101',
          studentName: 'Ali Valiyev',
          status: 'came',
          rating: 0,
          homeworkDone: false,
          comment: '',
          lockedByAdmin: false,
        },
        {
          studentId: '33333333-3333-4333-8333-333333333333',
          studentCode: 'ST102',
          studentName: 'Vali Aliyev',
          status: 'absent',
          rating: 0,
          homeworkDone: false,
          comment: '',
          lockedByAdmin: false,
        },
      ],
    })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/attendance'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          groupId: mockSessionApi.groupId,
          date: mockSessionApi.date,
          items: [
            {
              studentId: '22222222-2222-4222-8222-222222222222',
              status: 'CAME',
              rating: 0,
              homeworkDone: false,
              comment: '',
            },
            {
              studentId: '33333333-3333-4333-8333-333333333333',
              status: 'ABSENT',
              rating: null,
              homeworkDone: false,
              comment: '',
            },
          ],
        }),
      }),
    )
    expect(result.rows[0].rating).toBe(0)
  })
})
