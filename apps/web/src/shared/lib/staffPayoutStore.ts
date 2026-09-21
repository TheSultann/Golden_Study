/**
 * @deprecated Legacy localStorage hack. All staff payouts are now recorded and loaded
 * directly via backend ledger entries (POST /api/v1/staff/:id/payout and GET /api/v1/transactions).
 */
export interface StaffPayoutRecord {
  id: string
  staffId: string
  staffName: string
  staffLogin: string
  amount: number
  comment: string
  paidAt: string
}

const STORAGE_KEY = 'gs_staff_payouts_v1'

export function getLocalStaffPayouts(): StaffPayoutRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

export function saveLocalStaffPayout(record: StaffPayoutRecord): void {
  try {
    const current = getLocalStaffPayouts()
    const updated = [record, ...current.filter((r) => r.id !== record.id)]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch {
    // Ignore storage errors
  }
}

export function getStaffLastPaidMap(): Record<string, string> {
  const payouts = getLocalStaffPayouts()
  const map: Record<string, string> = {}
  for (const p of payouts) {
    if (!map[p.staffId] || new Date(p.paidAt) > new Date(map[p.staffId])) {
      map[p.staffId] = p.paidAt
    }
  }
  return map
}
