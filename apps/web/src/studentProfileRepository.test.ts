import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiStudentProfileRepository } from './features/student-profile/apiStudentProfile.repository'

const mockProfile = {
  success: true,
  data: {
    student: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      code: 'ST101',
      firstName: 'Alisher',
      lastName: 'Navoiy',
      birthDate: '2000-01-01',
      phone: '+998901234567',
      parentName: 'Ota-ona',
      parentPhone: '+998901234567',
      address: 'Toshkent',
      status: 'active',
      balance: 150000,
      groups: [],
    },
    academicSummary: {
      ratingScore: 90,
      groupPlace: 1,
      examAveragePercent: 85,
      attendancePercent: 95,
      homeworkPercent: 90,
    },
    updatedAt: '2026-07-21T00:00:00.000Z',
  },
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ApiStudentProfileRepository', () => {
  it('returns a complete profile from API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockProfile,
      }),
    )

    const repository = new ApiStudentProfileRepository()
    const result = await repository.getById('550e8400-e29b-41d4-a716-446655440000')

    expect(result.student.code).toBe('ST101')
    expect(result.academicSummary.ratingScore).toBe(90)
  })
})
