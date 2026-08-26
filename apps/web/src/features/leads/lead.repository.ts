import type { Lead, LeadStatus } from '@golden-study/contracts'

export interface LeadRepository {
  list(): Promise<Lead[]>
  save(v: Lead): Promise<Lead>
  move(id: string, status: LeadStatus): Promise<Lead>
  archive(id: string): Promise<void>
}
