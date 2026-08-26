import { describe, expect, it, vi } from 'vitest'
import { ApiTeacherExamsRepository } from './apiTeacherExams.repository'

vi.mock('../../shared/api/httpClient', () => ({
  apiRequest: vi.fn().mockImplementation((_path, options) => {
    if (options?.method === 'DELETE') {
      return Promise.resolve({ success: true })
    }
    return Promise.resolve({ data: [] })
  }),
}))

describe('ApiTeacherExamsRepository', () => {
  it('calls delete endpoint with z.any() schema without throwing TypeError', async () => {
    const repo = new ApiTeacherExamsRepository()
    await expect(repo.delete('exam-123')).resolves.not.toThrow()
  })
})
