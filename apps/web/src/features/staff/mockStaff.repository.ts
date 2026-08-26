import type { StaffCreateInput, StaffMember } from '@golden-study/contracts'
import type { StaffRepository } from './staff.repository'

export const mockStaffList: StaffMember[] = [
  {
    id: 'staff-1',
    fullName: 'Administrator',
    login: 'admin',
    phone: '+998 90 123 45 67',
    role: 'superadmin',
    position: 'Bosh administrator',
    passportPinfl: '31204951230045',
    hiredAt: '2024-01-01',
    avatarUrl: null,
    salaryUzs: 0,
    status: 'active',
    linkedTeacherId: null,
    linkedTeacherName: null,
    lastLoginAt: '2026-07-24T12:00:00.000Z',
    lastSalaryPaidAt: null,
    createdAt: '2024-01-01T09:00:00.000Z',
  },
]

export class MockStaffRepository implements StaffRepository {
  private staff: StaffMember[] = [...mockStaffList]

  async list(): Promise<StaffMember[]> {
    return [...this.staff]
  }

  async create(input: StaffCreateInput): Promise<StaffMember> {
    const newMember: StaffMember = {
      id: `staff-${Date.now()}`,
      fullName: input.fullName,
      login: input.login,
      phone: input.phone,
      role: input.role,
      position: input.position ?? null,
      passportPinfl: input.passportPinfl ?? null,
      hiredAt: input.hiredAt ?? null,
      avatarUrl: null,
      salaryUzs: input.salaryUzs ?? null,
      status: 'active',
      linkedTeacherId: null,
      linkedTeacherName: null,
      lastLoginAt: null,
      lastSalaryPaidAt: null,
      createdAt: new Date().toISOString(),
    }
    this.staff.unshift(newMember)
    return newMember
  }

  async update(member: StaffMember): Promise<StaffMember> {
    this.staff = this.staff.map((s) => (s.id === member.id ? { ...s, ...member } : s))
    return member
  }

  async setStatus(id: string, status: StaffMember['status']): Promise<StaffMember> {
    let updated: StaffMember | undefined
    this.staff = this.staff.map((s) => {
      if (s.id === id) {
        updated = { ...s, status }
        return updated
      }
      return s
    })
    if (!updated) throw new Error('Staff not found')
    return updated
  }

  async payout(id: string, _amount: number, _comment?: string): Promise<StaffMember> {
    let updated: StaffMember | undefined
    const nowIso = new Date().toISOString()
    this.staff = this.staff.map((s) => {
      if (s.id === id) {
        updated = { ...s, lastSalaryPaidAt: nowIso }
        return updated
      }
      return s
    })
    if (!updated) throw new Error('Staff not found')
    return updated
  }
}
