import { ApiFinanceRepository } from './apiFinance.repository'
import type { FinanceRepository } from './finance.repository'

export const financeRepository: FinanceRepository = new ApiFinanceRepository()
