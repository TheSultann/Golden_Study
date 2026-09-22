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
  homeworkText: 'Mashqlar 1-4',
  rows: [
    {
      studentId: '22222222-2222-4222-8222-222222222222',
      studentCode: 'ST101',
      studentName: 'Ali Valiyev',
      status: 'CAME' as const,
      rating: 95,
      homeworkScore: 90,
      topicScore: 95,
      dictionaryScore: 100,
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
      homeworkText: 'Mashqlar 1-4',
      rows: [
        {
          studentId: '22222222-2222-4222-8222-222222222222',
          studentCode: 'ST101',
          studentName: 'Ali Valiyev',
          status: 'came',
          rating: 95,
          homeworkScore: 90,
          topicScore: 95,
          dictionaryScore: 100,
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
      homeworkText: 'Mashqlar 1-4',
      rows: [
        {
          studentId: '22222222-2222-4222-8222-222222222222',
          studentCode: 'ST101',
          studentName: 'Ali Valiyev',
          status: 'came',
          rating: 95,
          homeworkScore: 90,
          topicScore: 95,
          dictionaryScore: 100,
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
          homeworkText: 'Mashqlar 1-4',
          items: [
            {
              studentId: '22222222-2222-4222-8222-222222222222',
              status: 'CAME',
              rating: 95,
              homeworkScore: 90,
              topicScore: 95,
              dictionaryScore: 100,
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
            { ...mockSessionApi.rows[0], rating: 0, homeworkScore: 0, topicScore: 0, dictionaryScore: 0, status: 'CAME' },
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
      homeworkText: '',
      rows: [
        {
          studentId: '22222222-2222-4222-8222-222222222222',
          studentCode: 'ST101',
          studentName: 'Ali Valiyev',
          status: 'came',
          rating: 0,
          homeworkScore: 0,
          topicScore: 0,
          dictionaryScore: 0,
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
          homeworkScore: 0,
          topicScore: 0,
          dictionaryScore: 0,
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
          homeworkText: '',
          items: [
            {
              studentId: '22222222-2222-4222-8222-222222222222',
              status: 'CAME',
              rating: 0,
              homeworkScore: 0,
              topicScore: 0,
              dictionaryScore: 0,
              homeworkDone: false,
              comment: '',
            },
            {
              studentId: '33333333-3333-4333-8333-333333333333',
              status: 'ABSENT',
              rating: null,
              homeworkScore: null,
              topicScore: null,
              dictionaryScore: null,
              homeworkDone: false,
              comment: '',
            },
          ],
        }),
      }),
    )
    expect(result.rows[0].rating).toBe(0)
  })

  it('falls back to rating when specific score fields are null in legacy records', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          ...mockSessionApi,
          rows: [
            {
              studentId: '22222222-2222-4222-8222-222222222222',
              studentCode: 'ST101',
              studentName: 'Ali Valiyev',
              status: 'CAME' as const,
              rating: 85,
              homeworkScore: null,
              topicScore: null,
              dictionaryScore: null,
              homeworkDone: true,
              comment: '',
              lockedByAdmin: false,
            },
          ],
        },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const repo = new ApiAttendanceRepository()
    const result = await repo.get(mockSessionApi.groupId, mockSessionApi.date)

    expect(result.rows[0].rating).toBe(85)
    expect(result.rows[0].homeworkScore).toBe(85)
    expect(result.rows[0].topicScore).toBe(85)
    expect(result.rows[0].dictionaryScore).toBe(85)
  })

  it('calculates smart average skipping null scores when saving partial grades', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          ...mockSessionApi,
          rows: [
            {
              studentId: '22222222-2222-4222-8222-222222222222',
              studentCode: 'ST101',
              studentName: 'Ali Valiyev',
              status: 'CAME' as const,
              rating: 90,
              homeworkScore: null,
              topicScore: 90,
              dictionaryScore: null,
              homeworkDone: false,
              comment: '',
              lockedByAdmin: false,
            },
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
      homeworkText: '',
      rows: [
        {
          studentId: '22222222-2222-4222-8222-222222222222',
          studentCode: 'ST101',
          studentName: 'Ali Valiyev',
          status: 'came',
          rating: null,
          homeworkScore: null,
          topicScore: 90,
          dictionaryScore: null,
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
          homeworkText: '',
          items: [
            {
              studentId: '22222222-2222-4222-8222-222222222222',
              status: 'CAME',
              rating: 90, // average of only [90], NOT 30
              homeworkScore: null,
              topicScore: 90,
              dictionaryScore: null,
              homeworkDone: false,
              comment: '',
            },
          ],
        }),
      }),
    )
    expect(result.rows[0].rating).toBe(90)
    expect(result.rows[0].homeworkScore).toBeNull()
    expect(result.rows[0].topicScore).toBe(90)
    expect(result.rows[0].dictionaryScore).toBeNull()
  })

  it('faithfully preserves homeworkDone boolean when homeworkScore is null or 0', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          ...mockSessionApi,
          rows: [
            {
              studentId: '22222222-2222-4222-8222-222222222222',
              studentCode: 'ST101',
              studentName: 'Ali Valiyev',
              status: 'CAME' as const,
              rating: 80,
              homeworkScore: null,
              topicScore: 80,
              dictionaryScore: 80,
              homeworkDone: true,
              comment: '',
              lockedByAdmin: false,
            },
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
      homeworkText: '',
      rows: [
        {
          studentId: '22222222-2222-4222-8222-222222222222',
          studentCode: 'ST101',
          studentName: 'Ali Valiyev',
          status: 'came',
          rating: 80,
          homeworkScore: null,
          topicScore: 80,
          dictionaryScore: 80,
          homeworkDone: true,
          comment: '',
          lockedByAdmin: false,
        },
      ],
    })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/attendance'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"homeworkDone":true'),
      }),
    )
    expect(result.rows[0].homeworkDone).toBe(true)
  })

  it('maps UNMARKED status from backend to unmarked in UI', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          ...mockSessionApi,
          rows: [
            {
              ...mockSessionApi.rows[0],
              status: 'UNMARKED',
              rating: null,
            },
          ],
        },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const repo = new ApiAttendanceRepository()
    const result = await repo.get(mockSessionApi.groupId, mockSessionApi.date)
    expect(result.rows[0].status).toBe('unmarked')
  })

  it('omits unmarked rows when saving if marked rows exist', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          ...mockSessionApi,
          rows: [
            {
              ...mockSessionApi.rows[0],
              status: 'ABSENT',
              rating: null,
            },
          ],
        },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const repo = new ApiAttendanceRepository()
    await repo.save({
      groupId: mockSessionApi.groupId,
      groupName: mockSessionApi.groupName,
      date: mockSessionApi.date,
      homeworkText: '',
      rows: [
        {
          studentId: '22222222-2222-4222-8222-222222222222',
          studentCode: 'ST101',
          studentName: 'Ali Valiyev',
          status: 'absent',
          rating: null,
          homeworkScore: null,
          topicScore: null,
          dictionaryScore: null,
          homeworkDone: false,
          comment: '',
          lockedByAdmin: false,
        },
        {
          studentId: '33333333-3333-4333-8333-333333333333',
          studentCode: 'ST102',
          studentName: 'Vali Aliyev',
          status: 'unmarked',
          rating: null,
          homeworkScore: null,
          topicScore: null,
          dictionaryScore: null,
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
          homeworkText: '',
          items: [
            {
              studentId: '22222222-2222-4222-8222-222222222222',
              status: 'ABSENT',
              rating: null,
              homeworkScore: null,
              topicScore: null,
              dictionaryScore: null,
              homeworkDone: false,
              comment: '',
            },
          ],
        }),
      }),
    )
  })
})
