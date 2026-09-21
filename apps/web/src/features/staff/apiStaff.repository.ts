import { staffListResponseSchema, staffResponseSchema, type StaffCreateInput, type StaffMember } from '@golden-study/contracts'

import { apiRequest } from '../../shared/api/httpClient'
import type { StaffRepository } from './staff.repository'

export class ApiStaffRepository implements StaffRepository {
  async list(): Promise<StaffMember[]> {
    const result = await apiRequest('/staff', { method: 'GET' }, staffListResponseSchema)
    return result.data
  }

  async create(input: StaffCreateInput): Promise<StaffMember> {
    const result = await apiRequest('/staff', { method: 'POST', body: JSON.stringify(input) }, staffResponseSchema)
    return result.data
  }

  async update(member: StaffMember): Promise<StaffMember> {
    const result = await apiRequest(`/staff/${member.id}`, { method: 'PATCH', body: JSON.stringify(member) }, staffResponseSchema)
    return result.data
  }

  async setStatus(id: string, status: StaffMember['status']): Promise<StaffMember> {
    const result = await apiRequest(`/staff/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }, staffResponseSchema)
    return result.data
  }

  async payout(id: string, amount: number, comment?: string): Promise<StaffMember> {
    const result = await apiRequest(`/staff/${id}/payout`, { method: 'POST', body: JSON.stringify({ amount, comment }) }, staffResponseSchema)
    return result.data
  }
}
