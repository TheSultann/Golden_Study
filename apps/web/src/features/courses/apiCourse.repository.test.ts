import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiCourseRepository } from './apiCourse.repository'

const apiCourse = {
  id: '22222222-2222-4222-8222-222222222222',
  title: 'IELTS',
  description: 'Preparation',
  durationMonths: 6,
  pricePerMonthUzs: 750_000,
  isActive: true,
  groupsCount: 2,
  studentsCount: 18,
  createdAt: '2026-07-18T10:00:00.000Z',
  updatedAt: '2026-07-18T10:00:00.000Z',
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ApiCourseRepository', () => {
  it('maps paginated API courses to UI courses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          success: true,
          data: [apiCourse],
          meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
        }),
      ),
    )

    await expect(new ApiCourseRepository().list()).resolves.toEqual([
      {
        id: apiCourse.id,
        title: 'IELTS',
        description: 'Preparation',
        durationMonths: 6,
        pricePerMonth: 750_000,
        groupsCount: 2,
        studentsCount: 18,
        active: true,
      },
    ])
  })

  it.each([
    ['create', 'POST', '/courses'],
    ['update', 'PATCH', `/courses/${apiCourse.id}`],
  ] as const)('sends exact %s payload', async (operation, method, path) => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ success: true, data: apiCourse }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const repository = new ApiCourseRepository()
    const course = {
      id: operation === 'create' ? 'new-course' : apiCourse.id,
      title: 'IELTS',
      description: 'Preparation',
      durationMonths: 6,
      pricePerMonth: 750_000,
      groupsCount: 99,
      studentsCount: 99,
      active: true,
    }

    await repository[operation](course)

    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:3000/api/v1${path}`,
      expect.objectContaining({
        method,
        body: JSON.stringify({
          title: 'IELTS',
          description: 'Preparation',
          durationMonths: 6,
          pricePerMonthUzs: 750_000,
        }),
      }),
    )
  })

  it.each([
    [false, 'deactivates'],
    [true, 'reactivates'],
  ])('%s course status via PATCH /courses/:id/status', async (active) => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ success: true, data: { ...apiCourse, isActive: active } }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      new ApiCourseRepository().setActive(apiCourse.id, active),
    ).resolves.toBeUndefined()

    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:3000/api/v1/courses/${apiCourse.id}/status`,
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ isActive: active }),
      }),
    )
  })
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
