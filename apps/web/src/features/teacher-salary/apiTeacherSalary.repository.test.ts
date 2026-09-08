import { describe, expect, it, vi } from 'vitest'
import { ApiTeacherSalaryRepository } from './apiTeacherSalary.repository'

vi.mock('../../shared/api/httpClient', () => ({
  apiRequest: vi.fn().mockResolvedValue({
    data: {
      teacherName: 'Alisher Karimov',
      pendingBalanceUzs: 1200000,
      totalPaidUzs: 3500000,
      salaryType: 'percent',
      salaryRate: 80,
      lastPaidAt: '2026-08-01T10:00:00.000Z',
      history: [],
    },
  }),
}))

describe('ApiTeacherSalaryRepository', () => {
  it('fetches salary overview successfully', async () => {
    const repo = new ApiTeacherSalaryRepository()
    const result = await repo.getOverview()
    expect(result.teacherName).toBe('Alisher Karimov')
    expect(result.pendingBalanceUzs).toBe(1200000)
    expect(result.salaryType).toBe('percent')
  })
})
