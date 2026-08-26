import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiTeacherRepository } from './apiTeacher.repository'
import type { Teacher } from './teacher.types'

describe('ApiTeacherRepository', () => {
  const repository = new ApiTeacherRepository()
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('lists teachers and maps response', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            firstName: 'Alisher',
            lastName: 'Karimov',
            phone: '+998901234567',
            salaryType: 'PERCENT',
            fixedSalaryUzs: null,
            perStudentRateUzs: null,
            kpiRateBasisPoints: 8000,
            login: 'alisher.k',
            isActive: true,
            groupsCount: 2,
            groups: ['Guruh 1', 'Guruh 2'],
            createdAt: '2026-07-20T10:00:00.000Z',
            updatedAt: '2026-07-20T10:00:00.000Z',
          },
        ],
        meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
      }),
    })

    const teachers = await repository.list()
    expect(teachers).toHaveLength(1)
    expect(teachers[0]).toEqual({
      id: '550e8400-e29b-41d4-a716-446655440000',
      firstName: 'Alisher',
      lastName: 'Karimov',
      phone: '+998901234567',
      salaryType: 'percent',
      rate: 80,
      kpiBalance: 0,
      groups: ['Guruh 1', 'Guruh 2'],
      login: 'alisher.k',
      active: true,
    })
  })

  it('creates teacher and maps inputs', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          id: '550e8400-e29b-41d4-a716-446655440001',
          firstName: 'Dilshod',
          lastName: 'Salimov',
          phone: '+998911112233',
          salaryType: 'FIXED',
          fixedSalaryUzs: 5000000,
          perStudentRateUzs: null,
          kpiRateBasisPoints: null,
          login: 'dilshod.s',
          isActive: true,
          groupsCount: 0,
          groups: [],
          createdAt: '2026-07-20T10:00:00.000Z',
          updatedAt: '2026-07-20T10:00:00.000Z',
        },
      }),
    })

    const input: Teacher = {
      id: 'new-123',
      firstName: 'Dilshod',
      lastName: 'Salimov',
      phone: '+998 91 111 22 33',
      salaryType: 'fixed',
      rate: 5000000,
      kpiBalance: 0,
      groups: [],
      login: 'dilshod.s',
      active: true,
    }

    const created = await repository.create(input)
    expect(created.id).toBe('550e8400-e29b-41d4-a716-446655440001')
    expect(created.rate).toBe(5000000)
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/teachers',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          firstName: 'Dilshod',
          lastName: 'Salimov',
          phone: '+998911112233',
          login: 'dilshod.s',
          password: 'Password123!',
          salaryType: 'FIXED',
          fixedSalaryUzs: 5000000,
        }),
      }),
    )
  })

  it('deactivates teacher via DELETE endpoint', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 204,
      text: async () => '',
    })

    const result = await repository.setActive('550e8400-e29b-41d4-a716-446655440000', false)
    expect(result.active).toBe(false)
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/teachers/550e8400-e29b-41d4-a716-446655440000',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })
})
