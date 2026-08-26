import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiLeadRepository } from './apiLead.repository'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const mockLeadApi = {
  id: '33333333-3333-4333-8333-333333333333',
  fullName: 'Jasur Bekov',
  phone: '+998901234567',
  interestedCourseId: null,
  interestedCourseTitle: 'English Beginners',
  teacherId: null,
  teacherName: 'Elena Ivanova',
  status: 'NEW' as const,
  comment: 'Qiziqmoqda',
  convertedStudentId: null,
  createdAt: '2026-07-21T10:00:00.000Z',
  updatedAt: '2026-07-21T10:00:00.000Z',
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ApiLeadRepository', () => {
  it('lists and maps API leads to UI leads', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: [mockLeadApi],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const repository = new ApiLeadRepository()
    const result = await repository.list()

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/leads?limit=100'),
      expect.objectContaining({ method: 'GET' }),
    )
    expect(result).toEqual([
      {
        id: mockLeadApi.id,
        fullName: 'Jasur Bekov',
        phone: '+998901234567',
        course: 'English Beginners',
        teacher: 'Elena Ivanova',
        status: 'new',
        comment: 'Qiziqmoqda',
        createdAt: '2026-07-21T10:00:00.000Z',
      },
    ])
  })

  it('creates new lead via POST', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: mockLeadApi,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const repository = new ApiLeadRepository()
    await repository.save({
      id: 'new-lead-1',
      fullName: 'Jasur Bekov',
      phone: '+998901234567',
      course: 'English Beginners',
      teacher: 'Elena Ivanova',
      status: 'new',
      comment: 'Qiziqmoqda',
      createdAt: '2026-07-21T10:00:00.000Z',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/leads'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          fullName: 'Jasur Bekov',
          phone: '+998901234567',
          comment: 'Qiziqmoqda',
          interestedCourseId: null,
          teacherId: null,
        }),

      }),
    )
  })

  it('converts lead via POST /convert', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          lead: { ...mockLeadApi, status: 'CONVERTED' },
          student: {},
        },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const repository = new ApiLeadRepository()
    const result = await repository.move(mockLeadApi.id, 'converted')

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`/leads/${mockLeadApi.id}/convert`),
      expect.objectContaining({ method: 'POST' }),
    )
    expect(result.status).toBe('converted')
  })

  it('archives lead via DELETE with 204 No Content', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    const repository = new ApiLeadRepository()
    await repository.archive(mockLeadApi.id)

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`/leads/${mockLeadApi.id}`),
      expect.objectContaining({ method: 'DELETE' }),
    )
  })
})

