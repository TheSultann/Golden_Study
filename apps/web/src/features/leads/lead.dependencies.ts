import { ApiLeadRepository } from './apiLead.repository'
import type { LeadRepository } from './lead.repository'

export const leadRepository: LeadRepository = new ApiLeadRepository()
