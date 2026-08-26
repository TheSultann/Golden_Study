import type { StaffCreateInput, StaffMember } from '@golden-study/contracts'

export interface StaffRepository {
  list(): Promise<StaffMember[]>
  create(input: StaffCreateInput): Promise<StaffMember>
  update(member: StaffMember): Promise<StaffMember>
  setStatus(id: string, status: StaffMember['status']): Promise<StaffMember>
  payout(id: string, amount: number, comment?: string): Promise<StaffMember>
}
